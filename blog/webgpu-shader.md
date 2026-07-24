# WebGPU 的渲染原理与 Shader

一帧游戏画面里，人物在草地上站着，手里武器轻轻摆动，剑身外环绕着流动的法术光环，头顶还有无数粒子往天上飞——这些看起来像「魔法」，底层却是同一条清晰的链路：

**CPU 准备数据与命令 → 提交给 GPU → GPU 按批次跑完顶点着色、光栅化、片元着色、深度测试与混合 → 先写进显存里的帧缓冲 → 整帧结束后再呈现到显示器。**

本文把这条链路讲透。人物、武器、光效、粒子会作为贯穿例子出现；最后补充 WebGPU / WebGL 一类图形 API 里 UI 与文字是怎么画出来的。配套可运行演示见 [`webgpu-shader-demo`](../webgpu-shader-demo/)。浏览器以 Chrome / Edge 的 WebGPU 支持最为稳定。

---

## 1. 先建立正确的心智模型

### 1.1 CPU 与 GPU 各自干什么

CPU 擅长串行逻辑：读输入、跑游戏逻辑、算骨骼与矩阵、决定「这一帧要画哪些东西、按什么顺序画」。它不会去逐个像素算光照——那太慢了。

GPU 擅长大规模并行：同一段短程序（Shader）被成千上万个硬件单元同时执行，每个单元处理不同的顶点或不同的片元（像素候选）。人物网格上的几万个顶点、屏幕上被三角形盖住的几十万片元，就是靠这种并行算完的。

因此：

- **CPU**：初始化设备与资源；每帧更新动画；把绘制意图写成命令；`submit` 交给 GPU。
- **GPU**：执行命令；在图形管线里把几何变成颜色；必要时用 Compute Shader 先更新粒子等数据。

### 1.2 场景里「看得见」的东西，各自是什么网格

以我们的演示场景为例，画面不是「一个超级模型」画出来的，而是多套几何、多套着色器叠加的结果：

| 画面元素 | 本质 | 典型着色 |
|---|---|---|
| 草地 | 大平面三角形 | 不透明 FS：程序化绿色 / 噪声草感 |
| 人物 | 头、躯干、四肢等多块网格 | 不透明 VS 做姿态；FS 做皮肤/衣服明暗 |
| 武器 | 独立网格，挂在手上 | 不透明 VS 跟随手部摆动；FS 做金属高光 |
| 环线法术 | **另一套**圆环薄网格，绑在武器旁 | 半透明 FS：流动 UV、发光、边缘衰减 |
| 头顶粒子 | 海量实例四边形；位置由 Compute 更新 | 广告牌 VS + 软光斑 FS |

关键点：武器本体上的金属光泽，和武器**周围**漂浮的法术环，不是同一个片元着色器「画大一点」得来的。片元着色器只能给**已经被三角形覆盖到的像素**上色；环在剑身外面，就必须有覆盖外面的三角形（或粒子面片、或全屏后处理）。视觉上「贴在武器周围」，靠的是 CPU/动画系统把两套网格的变换矩阵绑在一起。

### 1.3 一帧里 GPU 真正循环的单位是「批次」，不是「物体」

CPU 可以按物体遍历去更新矩阵，但提交给 GPU 时会把「同一套管线状态（着色器、混合模式、深度状态等）下的多次绘制」组织成**批次（batch）**。

GPU 执行时：

- **批次与批次之间**：通常串行——换完人物管线再换武器管线，再换半透明光环管线。
- **同一批次内部**：VS → 光栅化 → FS → 深度/模板 → 混合 是流水线重叠推进的，成千上万顶点/片元并行，而不是「先算完所有顶点再算所有像素」，也不是「一个物体完整走完管线再下一个物体」。

下文按时间顺序，从 CPU 初始化一直讲到屏幕亮起来。

---

## 2. CPU 侧：从拿到设备，到把命令交出去

可以把 CPU 工作分成「启动时做一次」和「每帧都做」。先把 `submit` 在内存上干的事压成一句：

- **指令清单（CommandBuffer）住在系统内存（RAM）**：`CommandEncoder` 录制的 `setPipeline` / `draw` / `dispatch` 等，是浏览器进程里的一张「操作菜单」；`device.queue.submit([...])` 把这张菜单的所有权交给驱动队列——**仍然主要在系统内存侧排队**，现代 GPU 常靠 DMA 直接读这份指令，而不是先整份拷进显存。
- **渲染资源本体住在显存（VRAM）**：`createBuffer` / `createTexture` 得到的顶点、索引、Uniform、Storage、深度/颜色纹理等，从创建起就常驻显卡；GPU 执行 `draw` 时按指令里的资源句柄去 **VRAM** 取数。

因此：

| 东西 | 在哪 | `submit` 会不会再搬一次 |
|---|---|---|
| JS 里的 `Float32Array`（算好的顶点、本帧矩阵） | 系统内存 | 不会；要进 GPU 得靠启动时/每帧的 `queue.writeBuffer`（或映射写入）**显式上传** |
| `GPUBuffer` / `GPUTexture`（网格、贴图、粒子 Storage、帧缓冲） | 显存 | **不会**；`submit` 不携带顶点像素，只写「去读几号缓冲、画几次」 |
| `GPUCommandBuffer`（`encoder.finish()` 的结果） | 系统内存里的指令清单 | **会移交**这份清单给队列；移交的是指令，不是模型本体 |

常见误解：以为每帧 `submit` 都会把人物、武器网格再推一遍进显卡。  
事实是：网格早已在显存；每帧最多再 `writeBuffer` 更新一小段 Uniform（矩阵、时间），然后 `submit` 一张操作清单让 GPU 去显存里画。

### 2.1 启动：拿到 GPU，建好画布与长期资源

典型步骤：

1. **检测与创建设备（几乎不占显存业务数据）**  
   `navigator.gpu` → `requestAdapter()` → `requestDevice()`。得到的 `GPUDevice` 是后续创建缓冲、管线、提交命令的入口；`device.queue` 是默认提交队列。Adapter/Device 是 API 对象，住在浏览器进程；真正大块业务数据要等你 `createBuffer`。

2. **配置画布（交换链纹理在显存）**  
   `canvas.getContext('webgpu')`，再 `configure({ device, format, ... })`。之后每帧 `getCurrentTexture()` 拿到的颜色附件是**显存**里的可呈现纹理。

3. **创建长期资源（网格进显存，管线只绑定状态）**  
   - 用 JS 算出顶点/索引（系统内存），再 `createBuffer` + `writeBuffer` 拷进显存；上传源可丢。  
   - `createTexture` 建深度缓冲等（显存）。  
   - `createShaderModule` / `createRenderPipeline` / `createComputePipeline`：编译后的着色器与固定功能状态（深度写不写、开不开混合）。它们是驱动管理的管线对象，绑定的是上面那些显存资源，**不要和「每帧再传一遍网格」混为一谈**。  
   - `createBindGroup`：轻量描述符，指向已有的 buffer/texture。

启动时就应建好两套管线，用来**区分批次**（详见下一节）：

- **不透明管线 `opaquePipeline`**：`depthWriteEnabled: true`，`depthCompare: 'less'`，**不开** `blend`（或等价于直接覆盖）。草地、人物、武器共用它（或同状态的管线）。
- **半透明管线 `auraPipeline` / `particlePipeline`**：`depthWriteEnabled: false`（测深度但不写入），`depthCompare: 'less'`，**打开** `blend`（如 `src-alpha` + `one` 加色）。法术环、粒子用它们。

「批次」在 WebGPU 里不是单独的 API 类型，而是：**同一次 `setPipeline(某管线)` 之后、下一次换管线之前，连续的若干次 `draw`/`drawIndexed`**。管线对象里已经烤死了深度与混合状态，所以换管线 = 换批次语义。

### 2.2 每帧：逻辑更新、写显存 Uniform，再按批次编码命令

在 `requestAnimationFrame` 回调里分三步。

**第一步：在普通内存里算逻辑**

- 人物根变换、待机晃动  
- 手部挂点 × `sin(time)` → 武器摆动矩阵  
- 法术环跟随武器并自旋  
- 相机算出 `viewProj`  
这些矩阵先存在 JS 的 `Float32Array`（**普通内存**）。

**第二步：把本帧变化拷进显存**

- `queue.writeBuffer(uniformBuf, …)`：矩阵、时间、灯光 → **显存** Uniform  
- `queue.writeBuffer(simUniform, …)`：粒子发射器（头顶世界坐标）、`dt` → **显存**  
粒子位置数组本身已在显存 StorageBuffer 里；本帧用 Compute Pass 在 GPU 上改它，不必整表读回 CPU。

**第三步：编码时如何「指明」不透明批次与半透明批次**

推荐顺序：

1. Compute Pass（更新粒子 StorageBuffer，数据在**显存**）  
2. **不透明批次**：`setPipeline(opaquePipeline)` —— 这一次调用就指明「接下来按不透明规则画」  
3. **半透明批次**：`setPipeline(auraPipeline)` / `setPipeline(particlePipeline)` —— 换管线即换批次，深度写入关闭、混合打开  

具体指法：

**不透明批次怎么指明**

```js
// 创建管线时已写死：开深度写入、不开混合
const opaquePipeline = device.createRenderPipeline({
  // ...
  depthStencil: {
    format: "depth24plus",
    depthWriteEnabled: true,   // 写入深度，后面物体可被挡住
    depthCompare: "less",
  },
  fragment: {
    targets: [{ format }],     // 不设 blend → 不透明覆盖
  },
});

// 录制时：setPipeline 一次 = 进入不透明批次
pass.setPipeline(opaquePipeline);
pass.setBindGroup(0, groundBindGroup);
pass.setVertexBuffer(0, groundVB);  // VB 在显存
pass.setIndexBuffer(groundIB, "uint16");
pass.drawIndexed(...);              // 草地

pass.setBindGroup(0, characterBindGroup);
pass.setVertexBuffer(0, characterVB);
pass.setIndexBuffer(characterIB, "uint16");
pass.drawIndexed(...);              // 人物——仍属同一不透明批次（管线未换）

pass.setBindGroup(0, weaponBindGroup);
pass.setVertexBuffer(0, weaponVB);
pass.setIndexBuffer(weaponIB, "uint16");
pass.drawIndexed(...);              // 武器——仍是不透明批次
```

同一 `opaquePipeline` 下连续多次 `drawIndexed`，只是换了 BindGroup / 顶点缓冲 / 索引缓冲（都在显存），**不会**更换 shader，也**不会**改深度写入、混合配置——这些仍由当前管线固定为「写深度、不混合」。这就是合批：状态相同就不要拆开。

但要注意：**合批 ≠ 只走一遍渲染流程。**

- 每一次 `drawIndexed`，GPU 都会对自己这一笔几何完整走一遍：VS → 光栅化 → FS → 深度测试 → 混合（不透明时混合等价于覆盖）。  
- 画完草地后，再 `drawIndexed` 人物，人物会再走自己的一整遍；武器同理。  
- 三笔 draw 之间变的是「绑哪组 Uniform、用哪份顶点/索引」；不变的是「哪套 shader、开不开深度写、开不开混合」。  

所以可以记成：管线状态共享，绘制次数不合并；省的是切换成本，不是少算顶点和像素。

**半透明批次怎么指明（关深度写入 + 开混合）**

```js
const auraPipeline = device.createRenderPipeline({
  // ...
  depthStencil: {
    format: "depth24plus",
    depthWriteEnabled: false,  // 关键：测遮挡，但不改深度缓冲
    depthCompare: "less",
  },
  fragment: {
    targets: [{
      format,
      blend: {                 // 关键：打开混合，叠在已有底色上
        color: {
          srcFactor: "src-alpha",
          dstFactor: "one",    // 加色，法术发光常用
          operation: "add",
        },
        alpha: {
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
          operation: "add",
        },
      },
    }],
  },
});

// 必须先画完不透明，帧缓冲里已有草地/人/剑底色
pass.setPipeline(auraPipeline);    // 换管线 = 进入半透明批次
pass.setBindGroup(0, auraBindGroup);
pass.setVertexBuffer(0, auraVB);
pass.setIndexBuffer(auraIB, "uint16");
pass.drawIndexed(...);             // 法术环

pass.setPipeline(particlePipeline); // 粒子也可单独一套半透明管线
pass.setBindGroup(0, particleBindGroup);
pass.draw(6, particleCount);
```

半透明必须后画：混合要读帧缓冲里已有颜色。深度**写入**关掉，避免半透明表面把后面的半透明错误挡住；深度**测试**仍开，避免环画穿实心墙体。

编码本身（`createCommandEncoder` → `finish`）写在**普通内存**的指令清单里；清单里只有「用 opaquePipeline 画草地索引缓冲」「用 auraPipeline 画环」这类引用与 draw 计数，网格数据早已在显存。最后 `device.queue.submit([commandBuffer])` 把清单交给 GPU 队列，JS 通常立刻返回。

### 2.3 从 `navigator.gpu` 到 `submit` 的 JS 示例

下面按真实 API 顺序串起完整骨架。网格数字、WGSL 正文用省略号；**重点标出：资源建在显存、指令在普通内存、如何用两套管线区分不透明/半透明批次。**

```js
// ========== 1. 设备（API 对象；业务大块数据尚未进显存）==========
if (!navigator.gpu) throw new Error("WebGPU unsupported");
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;

const canvas = document.querySelector("canvas");
const context = canvas.getContext("webgpu");
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: "opaque" });
// configure 之后，每帧 getCurrentTexture() 的颜色附件在【显存】

// ========== 2. 在【普通内存】准备上传源，再 createBuffer 进【显存】==========
const groundVertices = new Float32Array([/* 位置/法线/UV ... */]);
const groundIndices = new Uint16Array([/* ... */]);
// 同上：characterVertices / weaponVertices / auraVertices ...

const groundVB = device.createBuffer({
  size: groundVertices.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // 【显存】
});
queue.writeBuffer(groundVB, 0, groundVertices); // 普通内存 → 显存

const groundIB = device.createBuffer({
  size: groundIndices.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, // 【显存】
});
queue.writeBuffer(groundIB, 0, groundIndices);

// characterVB/IB、weaponVB/IB、auraVB/IB 同理……

const opaqueUniform = device.createBuffer({
  size: 256,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // 【显存】每帧 writeBuffer
});
const auraUniform = device.createBuffer({
  size: 256,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // 【显存】
});
const particleStorage = device.createBuffer({
  size: particleCount * floatsPerParticle * 4,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, // 【显存】Compute 读写
});
queue.writeBuffer(particleStorage, 0, initialParticleData /* 普通内存源 */);

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: "depth24plus",
  usage: GPUTextureUsage.RENDER_ATTACHMENT, // 【显存】深度附件
});

// ========== 3. 两套管线 = 两种批次语义（状态烤在 Pipeline 里，【显存侧管线对象】）==========
const opaqueModule = device.createShaderModule({ code: opaqueWgsl /* ... */ });
const auraModule = device.createShaderModule({ code: auraWgsl /* ... */ });

// —— 不透明批次：开深度写入，不开混合 ——
const opaquePipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: opaqueModule,
    entryPoint: "vs_main",
    buffers: [{ arrayStride: 32, attributes: [/* pos/normal/uv */] }],
  },
  fragment: {
    module: opaqueModule,
    entryPoint: "fs_main",
    targets: [{ format }], // 无 blend
  },
  primitive: { topology: "triangle-list", cullMode: "back" },
  depthStencil: {
    format: "depth24plus",
    depthWriteEnabled: true,
    depthCompare: "less",
  },
});

// —— 半透明批次：关深度写入，打开混合 ——
const auraPipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: auraModule,
    entryPoint: "vs_main",
    buffers: [{ arrayStride: 32, attributes: [/* ... */] }],
  },
  fragment: {
    module: auraModule,
    entryPoint: "fs_main",
    targets: [{
      format,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
        alpha: {
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
          operation: "add",
        },
      },
    }],
  },
  primitive: { topology: "triangle-list", cullMode: "none" },
  depthStencil: {
    format: "depth24plus",
    depthWriteEnabled: false, // 半透明关键
    depthCompare: "less",
  },
});

// particleComputePipeline / particleRenderPipeline 同理（Compute + 半透明绘制）……

const groundBG = device.createBindGroup({
  layout: opaquePipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: opaqueUniform } }],
});
// characterBG、weaponBG、auraBG、particleBindGroup ……

// ========== 4. 每帧：普通内存算矩阵 → writeBuffer 进显存 → 录指令（普通内存）→ submit ==========
function frame(time) {
  // 4a. 【普通内存】算逻辑
  const viewProj = /* ... */;
  const characterModel = /* ... */;
  const weaponModel = /* ... */;
  const auraModel = /* ... */;
  const headWorld = /* 粒子发射点 ... */;

  // 4b. 拷进【显存】Uniform（不是 submit 时才传网格）
  queue.writeBuffer(opaqueUniform, 0, /* pack viewProj + model + ... */);
  queue.writeBuffer(auraUniform, 0, /* ... */);
  // queue.writeBuffer(simUniform, 0, emitter + dt + ...)

  // 4c. 指令清单在【普通内存】录制；draw 引用的 VB/IB/管线都在【显存】
  const encoder = device.createCommandEncoder();

  // （可选）Compute：只碰显存里的 particleStorage
  // const cpass = encoder.beginComputePass();
  // cpass.setPipeline(particleComputePipeline);
  // cpass.setBindGroup(0, particleComputeBG);
  // cpass.dispatchWorkgroups(Math.ceil(particleCount / 64));
  // cpass.end();

  const colorView = context.getCurrentTexture().createView(); // 显存颜色附件
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: colorView,
      clearValue: { r: 0.35, g: 0.55, b: 0.78, a: 1 },
      loadOp: "clear",
      storeOp: "store",
    }],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });

  // ----- 不透明批次：一次 setPipeline(opaque) 指明 -----
  pass.setPipeline(opaquePipeline);
  pass.setBindGroup(0, groundBG);
  pass.setVertexBuffer(0, groundVB);
  pass.setIndexBuffer(groundIB, "uint16");
  pass.drawIndexed(groundIndexCount);

  pass.setBindGroup(0, characterBG);
  pass.setVertexBuffer(0, characterVB);
  pass.setIndexBuffer(characterIB, "uint16");
  pass.drawIndexed(characterIndexCount);

  pass.setBindGroup(0, weaponBG);
  pass.setVertexBuffer(0, weaponVB);
  pass.setIndexBuffer(weaponIB, "uint16");
  pass.drawIndexed(weaponIndexCount);

  // ----- 半透明批次：换 auraPipeline = 关深度写 + 开混合 -----
  pass.setPipeline(auraPipeline);
  pass.setBindGroup(0, auraBG);
  pass.setVertexBuffer(0, auraVB);
  pass.setIndexBuffer(auraIB, "uint16");
  pass.drawIndexed(auraIndexCount);

  // pass.setPipeline(particleRenderPipeline);
  // pass.setBindGroup(0, particleRenderBG);
  // pass.draw(6, particleCount);

  pass.end();

  const commandBuffer = encoder.finish(); // 【普通内存】指令清单
  queue.submit([commandBuffer]);          // 移交队列；网格早在显存，此处不拷模型

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

读这段代码时抓住三件事即可：

1. **`createBuffer` / `createTexture` / Pipeline → 显存（或显存侧管线）**；JS 数组只是上传前的普通内存源。  
2. **`setPipeline(opaquePipeline)` 与 `setPipeline(auraPipeline)` 就是分批**：前者深度写入开、混合关；后者深度写入关、混合开。  
3. **`submit` 只提交指令清单（普通内存）**，GPU 按清单去显存里取 VB/Uniform/管线执行。

同一帧内 Compute Pass 与 Render Pass 写在同一个 encoder、一次 `submit` 最干净；粒子若依赖 Compute 写入的 StorageBuffer，实现会保证读取顺序正确。默认 `GPUQueue` 有序，「两次 submit 硬件必并行」不是 WebGPU 的保证。

---

## 3. GPU 侧：按批次消化命令，流水线把几何变成颜色

CPU 撒手之后，GPU 从队列里取出 command buffer，按录制顺序执行。遇到 Compute Pass 就调度计算着色器；遇到 Render Pass 就进入图形管线，并按其中的 `setPipeline` / `draw` 一段段推进。

下面聚焦图形管线：**一个批次从进入到写完帧缓冲，经历什么**。

### 3.1 批次循环长什么样

可以把 Render Pass 内部想成：

```text
for 每一个「管线状态段 / 批次」:
    加载该批次的 VS、FS、深度与混合配置、绑定资源
    对该批次内每一次 draw 调用:
        其几何进入流水线，可与同批次其他 draw 重叠执行:
            VS、光栅化、FS 可并行交错（不同三角形 / 不同 draw 同时进行）
        当多个片元争用同一 attachment 位置（像素 / MSAA 采样点）时:
            输出合并阶段（深度 / 模板 / 混合 / 写回）按 draw 录制顺序串行化
            （不透明：谁通过深度测试主要由深度值决定，非「后 draw 一定覆盖前 draw」）
        通过测试的片元 → 混合 → 写帧缓冲
    本批次全部 draw 都完成写帧缓冲后，才结束并切换下一套管线
```

对演示场景，GPU 大致依次吃掉：

1. 不透明：草地  
2. 不透明：人物  
3. 不透明：武器  
4. 半透明：法术环（可多圈）  
5. 半透明：粒子实例  

前三步若共用同一套不透明管线，只是换了顶点缓冲和 Uniform，切换成本低于「换一套完全不同的 WGSL」。法术环与粒子则要换混合状态（例如加色混合、关闭 depth write），属于明确的新批次。

**批次之间**：上一批全部 draw 都写完帧缓冲、相关工作按管线语义收尾后，再安全地换状态开下一批。  
**批次内部**：多次 draw 在 VS→光栅化→FS 上重叠推进；争用同一像素/采样点时，深度/模板/混合/写回须在输出合并阶段按录制顺序产生一致结果（详见 3.7）。

### 3.2 顶点着色器（VS）：决定「点在哪、带什么属性」

输入：顶点缓冲里的位置、法线、UV，以及 BindGroup 里的模型矩阵、`viewProj`、时间等。

每个顶点一次 VS（硬件上大量顶点并行）：

1. 用模型矩阵把局部坐标变到世界空间（人物晃动、武器摆动、法术环自旋都体现在这里的矩阵里）。  
2. 再乘视图投影，得到裁剪空间位置，最终对应屏幕上的位置。  
3. 把法线、UV 等输出给下一步；这些量会在三角形内部被插值。

对应例子：

- **人物 / 武器**：VS 几乎只做变换；摆动动画来自 CPU 每帧算好的矩阵，而不是在 FS 里「假装在动」。  
- **法术环**：VS 可再加一点沿法线的呼吸缩放，让环有膨胀感。  
- **粒子**：往往没有传统网格 VB，而是用 `instance_index` 去 StorageBuffer 里取第 i 个粒子的位置，再在 VS 里展开成朝向相机的四边形（广告牌）。位置本身可能刚被 Compute Pass 写过。

VS 结束时，GPU 得到的是「三角形的三个顶点在屏幕上的位置 + 待插值属性」。它还不知道三角形内部每个像素什么颜色。

### 3.3 光栅化：硬件把三角形拆成片元

光栅化是固定功能硬件，程序员写不了这段代码，但必须理解它做两件事：

1. **覆盖测试**：三角形盖住了屏幕上哪些像素中心（或采样点）→ 生成片元。  
2. **插值**：把三个顶点的 UV、法线、世界坐标等，按重心坐标插到每个片元上。

没有三角形覆盖的地方，就不会有片元，后面的 FS 也不会跑。这也是「剑身 FS 画不出剑外光环」的硬件原因：剑的三角形根本盖不住环所在的像素。

草地一整片大三角、人物身上密密的小三角、法术环的细管状三角、粒子的小四边形，都会在这一步变成大量片元队列，送给片元着色阶段。

### 3.4 片元着色器（FS）：决定「这个片元算出来是什么颜色」

每个片元一次 FS（同样大规模并行），输入是插值后的属性 + Uniform/纹理，输出通常是 `vec4` 颜色（在启用混合时还含 alpha）。

同一套硬件阶段，不同批次跑的是不同的 FS 程序：

- **草地**：用世界 XZ 或 UV 做噪声与条纹，算出深浅不一的绿色。  
- **人物**：简单漫反射 + 按高度区分皮肤/衣服颜色。  
- **武器**：金属底色 + 高光；可加一点边缘自发光暗示附魔。  
- **法术环**：时间滚动 UV、噪声闪烁、边缘透明衰减、高亮蓝色——输出带 alpha 的发光色。  
- **粒子**：根据到四边形中心的距离做软圆光斑，寿命越短越淡。

FS **不负责**「这个像素该不该挡住后面的物体」——那是深度测试；也**不负责**「怎么和背景叠在一起」——那是混合。FS 只给出「我提议的颜色（和 alpha）」。

> 补充：现代 GPU 常有 Early-Z，在满足条件时把深度测试提前到 FS 前，以跳过被挡住片元的着色。教学上仍按逻辑顺序「先算颜色意图，再测深度，再混合」理解依赖关系；硬件会重排能重排的部分。

### 3.5 深度与模板测试：这个片元能不能留下

片元带着自己的深度值，与深度附件里已有值比较（常见 `less`：更近者胜）。

- **测试失败**：丢弃，不写颜色（武器被身体挡住的部分不会画到前面）。  
- **测试通过**：进入混合；若开启深度写入，同时更新深度附件。

不透明批次里，**谁可见由深度值与比较函数（如 `less`）决定**，不是「后提交的 draw 一定盖住先提交的」——更近的片元通过后仍会写入，即便它来自更晚的 draw。

不透明的草地、人物、武器：通常 **深度测试 + 深度写入** 都开，保证遮挡正确。  
半透明的法术环与粒子：通常 **仍做深度测试**（被山挡住的环不该穿出来），但 **关闭深度写入**，避免半透明表面把后面的半透明错误挡住，也避免打乱后续透明排序。透明物体之间的正确排序更复杂（常按距离排序或用 OIT 等技术）；演示里粒子与环数量可控时，用加色混合也能得到稳定好看的效果。

模板测试同属这一固定阶段，用模板附件做遮罩、描边等；本场景可不启用，但管线位置与深度相同：都在 FS 之后的测试单元里（逻辑管线）。

### 3.6 颜色混合：和新颜色如何写进帧缓冲

通过测试的片元，其 FS 输出色与**帧缓冲里当前像素颜色**按混合方程组合，写回颜色附件。

- **不透明**：等价于直接覆盖（src 完全替换 dst），或 `src-alpha` 混合但 alpha=1。  
- **法术环 / 粒子**：常用「加色」或标准 alpha 混合，让发光叠在草地和人物之上，形成通透光感。

混合读的是**此刻显存帧缓冲里已经有的值**——若同一像素上有多个半透明片元依次通过深度测试，**混合顺序**同样须在输出合并阶段按 draw 录制顺序串行化，后到的片元读到的是先到片元写回后的结果。因此必须先画不透明底（草地、人、剑），再叠半透明；跨批次顺序不是审美问题，而是混合数学的前提。

### 3.7 单批次内部：流水线重叠，而不是两段式大循环

在同一批次、同一套管线里，硬件像工厂传送带：

1. 一部分顶点还在跑 VS；  
2. 更早完成的三角形已经在光栅化；  
3. 再早的片元已在 FS，或已进入输出合并（深度 / 模板 / 混合 / 写回）。  

三段同时推进，而不是：

- 错法 A：物体1 完整 VS→…→混合，再物体2……（按物体串行掏空流水线）；  
- 错法 B：先把本帧所有物体顶点全部 VS 完，缓存所有三角形，再统一光栅、统一 FS（带宽与缓存都扛不住，也不是硬件设计）。

**争用同一位置时的顺序**：不同 draw 的 VS、光栅、FS 可以并行；但当多个片元要读写**同一 attachment 位置**时，GPU 在**输出合并**（Output Merger / ROP）阶段把它们串行化，使深度/模板/混合/写回的结果与 API 提交顺序一致。Early-Z 等优化可能跳过部分 FS，但写回附件的最终语义仍须与此一致。

跨批次时才需要切换着色器与固定功能状态；那是合批优化要消灭的成本。

### 3.8 Compute 与图形管线如何衔接到粒子

粒子批次在 Render Pass 里看起来只是又一次 `draw`，但数据从哪来？

1. 同一 command buffer 靠前的 Compute Pass：每个线程（或每线程一个粒子）读旧 `pos/vel/life`，积分、重生，写回 StorageBuffer。  
2. 后面的粒子渲染 VS：按 `instance_index` 读同一个 buffer，生成广告牌。  
3. FS 画光斑，走半透明混合。  

这样，「头顶无数粒子往天上飞」拆成了：**并行更新状态（Compute）** + **并行画出来（VS/FS）**。两者都在 GPU 上，但阶段不同；CPU 只负责每帧提供发射点与 `dt`。

---

## 4. 帧缓冲与屏幕：什么时候算「画完」，人眼何时看见

这里必须把两层写入分开，否则会误以为「每画完一个批次屏幕就闪一下」。

### 4.1 第一层：写显存里的帧缓冲（边算边写）

颜色附件和深度附件是显存里的纹理（画布当前纹理 + 深度纹理）。每一个通过测试的片元，在混合完成后**立刻**修改帧缓冲对应像素。因此：

- 草地批次结束后，帧缓冲里已经有草地；  
- 人物批次在其上覆盖身体像素；  
- 武器再覆盖手中剑的像素；  
- 法术环与粒子按混合公式叠上去。  

这是「后台画板」上的实时涂改，发生在 GPU 执行 Render Pass 的过程中。

### 4.2 第二层：呈现（Present）到显示器（整帧一次）

人眼看到的刷新，不是每个批次结束时发生的。浏览器与交换链的规则是：与这次呈现相关的 GPU 工作完成后，再把完整一帧交给显示器扫描输出。中途帧缓冲里已经画了人、还没画粒子时，屏幕不会露出半成品（否则会撕裂、闪烁）。

因此：

- **帧缓冲更新**：随片元混合，逐像素、持续发生；  
- **屏幕更新**：整帧（至少是本次要呈现的那张画面）就绪后，按显示器刷新节奏出现。  

`requestAnimationFrame` 与垂直同步还会约束 CPU 提交新帧的节奏。若 GPU 一帧算不完，表现为掉帧，而不是无限堆积到内存爆炸——队列背压与刷新节奏会限流。

### 4.3 用一条时间线串起演示场景

```text
CPU: 更新人物/武器/环矩阵，写 Uniform，写粒子发射器
CPU: encoder 录制
        ComputePass  → 粒子 pos/vel/life 更新到 StorageBuffer
        RenderPass
          clear 颜色与深度
          draw 草地     → VS/光栅/FS/深度/混合 → 写帧缓冲
          draw 人物     → 同上（遮挡草地）
          draw 武器     → 同上（摆动姿态已在矩阵里）
          draw 法术环   → 半透明混合叠在人与剑上
          draw 粒子     → 读 Compute 结果，广告牌 + 光斑混合
CPU: submit，继续准备下一帧逻辑
GPU: 按队列执行上述命令；帧缓冲在显存中被逐步填满
浏览器/交换链: 呈现完整帧 → 显示器刷新 → 你看见这一帧
```

---

## 5. Shader 在原理里的位置（收束，不另起炉灶）

整篇文章的「原理」核心是管线与调度；Shader 是管线里**可编程的两段**（外加 Compute 旁路）：

- **VS**：并行改顶点——形状、动画落点、粒子广告牌。  
- **FS**：并行定颜色——材质、光照、法术流光、粒子光斑。  
- **光栅化 / 深度 / 混合**：固定功能（可配置），把「点」变成「可测遮挡、可叠透明的像素写入」。  

所谓 PBR、菲涅尔、噪声流光，都是 FS（或 VS 扰动）里的数学；它们改变的是某一阶段的输出，并不另造一条绕过帧缓冲的通路。外围法术、UI、文字，同样要落到「有几何覆盖 → 进管线 → 写帧缓冲」这条原则上。

---

## 6. WebGPU 中绘制 UI 与文字

3D 场景（草地、人物、武器、特效）全部画进帧缓冲之后，游戏还要画背包、血条、按钮、NPC 对话。它们仍然走同一套图形原理，只是几何变成**屏幕空间的四边形**，并通常放在**最后的批次**，保证永远盖在 3D 上面。

### 6.1 UI：图集上的矩形，而不是零散 PNG 各画各的

素材层面：

- 小图标可以是独立 PNG，但正式项目会把边框、按钮、图标打进**一张大图集（Sprite Sheet）**，用 UV 矩形取不同控件。  
- 可拉伸面板常用**九宫格**：四角不变形，边缘与中心按规则拉伸/平铺。  

渲染层面（WebGPU 与 WebGL 相同思想）：

1. CPU 为每个控件生成两个三角形（或合批进一个大动态顶点缓冲）。  
2. VS 把矩形直接放到屏幕/裁剪空间（正交投影），不做透视。  
3. FS 从同一张 UI 图集采样。  
4. 开启 alpha 混合，适配 PNG 透明。  
5. **合批**：整层 UI 尽量共用一张贴图、一套 UI shader，一次或少数几次 draw，避免每个按钮一次管线切换。  

顺序上：不透明 3D → 半透明 3D 特效 → UI 图集批次。UI 一般关闭深度测试或写在最近深度，避免被场景挡住。

### 6.2 文字：字体图集动态拼字，而不是一句对话一张图

文字不能为每个字符串预渲染成海量 PNG。标准做法是**字体纹理图集（Font Atlas）**：

1. 加载 TTF/OTF，把常用字符栅格化进一张（或数张）大贴图，记录每个字的 UV、宽高、字距。  
2. 运行时对字符串「你好，冒险者」为每个字符生成一个小四边形。  
3. VS 按排版算屏幕位置；FS 采样字形灰度（或 SDF 距离场）得到透明度，再乘文字颜色。  
4. 整段对话共用同一字体贴图与文字 shader，合批绘制。  

进阶常用 **SDF 字体**：贴图存的是到字形边缘的距离，FS 里阈值描边、阴影、发光，放大也更清晰。伤害飘字、对话框外发光，都是文字 FS 上的效果，原理仍是「四边形 + 图集 + 混合」。

### 6.3 把 UI/文字放回整帧批次清单

一帧完整批次可以是：

```text
Compute: 粒子更新
Render:
  不透明 3D（草地、人物、武器）
  半透明 3D（法术环、粒子）
  UI 图集（面板、按钮、图标）
  文字图集（对话、数值）
Present → 屏幕
```

UI、文字与 3D 特效一样：都要有三角形覆盖目标像素，都要经过 VS（哪怕只是二维变换）和 FS，都要在合适的混合与顺序下写入**同一块帧缓冲**，最后才被呈现。

---

## 7. 总结：一条原理链

1. **CPU** 初始化 Device / 画布 / 缓冲与管线；每帧更新人物、武器、光环、粒子发射参数；按「先 Compute、再不透明、再半透明、再 UI/文字」编码 CommandBuffer；`submit` 交出指令。  
2. **GPU** 按队列执行；Render Pass 内按批次切换管线；批次内 VS、光栅化、FS、深度/模板、混合流水推进，把草地、人、剑、环、粒子逐步写入显存帧缓冲。  
3. **帧缓冲**随混合实时更新；**屏幕**在整帧呈现时才变。  
4. **Shader** 是管线中的可编程段：VS 管位置与传递属性，FS 管颜色意图；固定阶段负责变成「正确遮挡、正确透明」的像素写入。  
5. **UI 与文字**是最后的屏幕空间批次，用图集与字体图集合批绘制，原理与 3D 相同。

把这条链吃透之后，再去看 PBR 公式或噪声流光，都只是某一段 FS/VS 里的细节；而「人物、武器、光效、粒子如何组成一帧」，则始终是调度与管线问题。本地演示 [`webgpu-shader-demo`](../webgpu-shader-demo/) 正是按同一条链实现的最小可运行样本。

---

## 8. 纯 WebGPU Shader 源码解读拾遗

前面各章按「原理链」讲渲染；本章反过来，对着 [`webgpu-shader-demo`](../webgpu-shader-demo/) 里容易一眼滑过、却又卡人的几处源码细节做拾遗。读时可对照 `src/main.js`、`src/geometry.js`、`src/mesh.js` 与 `src/pipelines/*.js`。

### 8.1 `format`：画布颜色格式的两端契约

演示启动时有一行：

```js
const format = navigator.gpu.getPreferredCanvasFormat();
```

它拿到的不是「随便一个字符串」，而是当前平台/浏览器**最合适的 canvas 颜色纹理格式**（`GPUTextureFormat`）。常见取值：

| 平台倾向 | `format` |
|---|---|
| 多数 Windows / macOS | `"bgra8unorm"` |
| 部分 Linux / Android | `"rgba8unorm"` |

含义大致是：每通道 8 位、归一化到 \[0,1\]、未强制标成 sRGB 的那一类。它描述的是：**最终要呈现到屏幕的那张颜色纹理，每个像素怎么存。**

#### 同一份 `format` 必须出现在两处

**① 配置交换链（决定纹理「长什么样」）**

```js
context.configure({
  device,
  format,
  alphaMode: "opaque",
});
```

之后每帧 `context.getCurrentTexture()` 返回的可呈现纹理，格式就是这个 `format`。

**② 创建渲染管线（声明片元「往哪种纹理上写」）**

`main.js` 把同一个 `format` 传给各管线工厂，最终进 `createRenderPipeline` 的 `fragment.targets`：

```js
// pipelines/opaque.js 等
fragment: {
  module,
  entryPoint: "fs_main",
  targets: [{ format }],  // 与 canvas 交换链格式必须一致
},
```

法术环、粒子管线同理；半透明管线只是在 `targets[0]` 上多配了 `blend`，**颜色格式仍用这份 `format`**。

可以把两端想成合同：

| 端 | 作用 |
|---|---|
| `context.configure({ format })` | 交换链颜色纹理用什么格式 |
| `createRenderPipeline` → `targets: [{ format }]` | 管线承诺只往这种格式的附件上写 |

两边必须相同。若管线写死 `"rgba8unorm"`、本机 `getPreferredCanvasFormat()` 却是 `"bgra8unorm"`，创建管线或 `beginRenderPass` 时会校验失败。所以 demo 从不手写格式字符串，而是**取一次 preferred，再处处复用**。

#### 和 `DEPTH_FORMAT` 不要混

demo 里颜色与深度是两套格式：

| 变量 | 典型值 | 用途 |
|---|---|---|
| `format`（preferred canvas） | `bgra8unorm` / `rgba8unorm` | 颜色附件 → 最后呈现到屏幕 |
| `DEPTH_FORMAT` | `"depth24plus"` | 深度附件 → 只做遮挡测试，**不进** canvas |

管线里对应两处声明：

```js
targets: [{ format }],                    // 颜色输出
depthStencil: { format: depthFormat, ... } // 深度附件
```

#### 附带：`resize` 为何反复 `configure`，却不传 `w/h`

读源码时容易疑惑：`window` 缩放时 `resize()` 会再调一次 `configure({ device, format, alphaMode })`，参数里没有宽高，为何还要反复调用？

尺寸不是写在 `configure` 参数里的，而是写在 **canvas 绘图缓冲**上：

```js
canvas.width = w;   // CSS 布局尺寸 × devicePixelRatio
canvas.height = h;
context.configure({ device, format, alphaMode: "opaque" });
// 未写 size 时，按当前 canvas.width / canvas.height 建交换链
```

`configure` 除了登记 `device/format`，还会按当前缓冲尺寸创建/绑定一块**固定分辨率**的交换链。窗口变大变小后：

1. 先改 `canvas.width/height`；  
2. 再 `configure` → 颜色交换链按新尺寸重建；  
3. 再 `recreateDepth()` → 深度纹理改成同样的新尺寸。  

若不重新 `configure`，`getCurrentTexture()` 可能仍是旧分辨率，而深度已按新尺寸重建，颜色与深度附件尺寸不一致，`beginRenderPass` 就会挂。规范也允许显式写 `size: [w, h]`；demo 选择「先设 canvas 尺寸、再 configure」——效果等价。

**一句话**：`format` 是颜色交换链与渲染管线之间的格式契约；`resize` 反复 `configure`，是为了在契约不变的前提下，让交换链分辨率跟着窗口走。

### 8.2 地面网格：`positions` / `normals` / `uvs` / `indices`

`geometry.js` 里的 `createGround` 用最少数据铺出一块草地：4 个顶点、2 个三角形。默认 `size = 24`（演示里常传 `28`）；下面以通用 `size`、半宽 `h = size / 2` 说明。

```js
export function createGround(size = 24) {
  const h = size / 2;
  const positions = [
    -h, 0, -h,  h, 0, -h,  h, 0, h,  -h, 0, h,
  ];
  const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const uvs = [0, 0, size, 0, size, size, 0, size];
  const indices = [0, 1, 2, 0, 2, 3];
  return {
    vertices: interleave(positions, normals, uvs),
    indices: new Uint16Array(indices),
    kind: "ground",
  };
}
```

约定坐标系（右手系，与 demo 一致）：**+Y 朝上**，地面躺在 **y = 0** 的 XZ 平面上；人物脚底也在 y=0，所以人站在这块板上。

```text
        +Y（上）
         |
         |
         o--------→ +X
        /
       /
     +Z（朝向你 / 场景前方，视相机而定）
```

#### `positions`：四个角在世界局部空间里的坐标

数组按「顶点 0、1、2、3」连续存放，每个顶点 3 个 float `(x, y, z)`：

| 顶点 | 展开后的数 | 坐标 | 空间含义 |
|---|---|---|---|
| V0 | `-h, 0, -h` | `(-h, 0, -h)` | 左后角 |
| V1 | `h, 0, -h` | `(h, 0, -h)` | 右后角 |
| V2 | `h, 0, h` | `(h, 0, h)` | 右前角 |
| V3 | `-h, 0, h` | `(-h, 0, h)` | 左前角 |

俯视（从 +Y 往下看）像一块以原点为中心、边长为 `size` 的正方形：

```text
              -Z
               ↑
     V0 ●------+------● V1
        |      |      |
        |      |      |
   -X ←-+------+------+→ +X
        |      |      |
        |      |      |
     V3 ●------+------● V2
               ↓
              +Z

边长 = size，中心在原点，全部 y = 0
```

斜视三维关系（高度全为 0，法线朝上）：

```text
                 +Y
                  ↑  n̂ = (0,1,0)
                  |
           V3 ●---+---● V2
             /|   |   |\
            / |   |   | \
       V0 ●--+----+---+--● V1   ← 整块板贴在 y=0
              \   |   /
               \  |  /
                \ | /
                 \|/
               原点 (0,0,0)
```

物理意义：这四个点就是 GPU 后面要变换、光栅化的**几何角点**；没有它们，草地就不会占屏幕上的任何像素。

#### `normals`：每个顶点的表面朝向

```js
normals = [0,1,0,  0,1,0,  0,1,0,  0,1,0];
```

每个顶点一个 `(nx, ny, nz)`，四个顶点全是 `(0, 1, 0)`——竖直向上。

物理意义：法线告诉片元着色器「这张面朝哪边」，用来算漫反射（光从上方打下来，草地才亮）。平面地面处处朝上，所以四个角共用同一法线。若写成 `(0,-1,0)`，背面朝上，光照会算成「背光」，草地发黑。

不透明 shader 里大致是：

```wgsl
let n = normalize(in.normal);
let l = normalize(-u.lightDir.xyz);
let ndotl = max(dot(n, l), 0.0);  // 法线与光线夹角 → 明暗
```

#### `uvs`：贴在平面上的二维「纹理坐标」

```js
uvs = [0, 0,  size, 0,  size, size,  0, size];
```

每个顶点 2 个 float `(u, v)`，与四角一一对应：

| 顶点 | UV | 含义 |
|---|---|---|
| V0 | `(0, 0)` | 纹理空间左下（约定） |
| V1 | `(size, 0)` | 沿 u 铺开整块边长 |
| V2 | `(size, size)` | 对角 |
| V3 | `(0, size)` | 沿 v 铺开 |

物理意义：UV 不是世界坐标，而是给着色器的**二维参数域**。demo 的草地并不采样真实贴图，而是用 `floor(uv * 18.0)` 做程序化格子/噪声草感；把范围设成 `0…size` 而不是 `0…1`，是为了边长变大时草纹密度大致跟着面积走，而不是整块地只铺一格图案。

俯视把 UV 叠在几何上：

```text
  V0 (u=0,v=0)          V1 (u=size,v=0)
        ●---------------------●
        |                     |
        |     UV 铺满整块地    |
        |                     |
        ●---------------------●
  V3 (u=0,v=size)       V2 (u=size,v=size)
```

#### `indices`：用哪几个顶点拼三角形

```js
indices = [0, 1, 2,  0, 2, 3];
```

GPU 画三角网格时，通常不按「顶点数组顺序」连线，而是看**索引**：每 3 个索引组成一个三角形。

| 三角形 | 索引 | 顶点 | 覆盖区域 |
|---|---|---|---|
| T0 | `0, 1, 2` | V0 → V1 → V2 | 正方形的「右后 → 右前」那一半 |
| T1 | `0, 2, 3` | V0 → V2 → V3 | 剩下的「左」那一半 |

```text
     V0 ●-----------● V1
        | ╲    T0   |
        |   ╲       |
        | T1  ╲     |
        |       ╲   |
     V3 ●-----------● V2

共享对角线：V0 → V2
```

物理意义：4 个点本身还不是面；两个三角形把正方形「缝」实，光栅化才会生成覆盖草地的片元。索引复用顶点（V0、V2 各出现两次），比再复制一份顶点更省。

绕序 `0→1→2`、`0→2→3` 在 +Y 朝上看是逆时针（或按项目绕序约定），配合管线 `cullMode: "back"`，从上方看得到正面，从地下往上看会被剔掉——符合「地面只朝上」的直觉。

#### 四者如何变成 GPU 顶点缓冲

`interleave` 把每个顶点的 position(3) + normal(3) + uv(2) 交错成一条紧密数组，再配上 `indices`：

```text
顶点缓冲（交错）:
  [V0.xyz | V0.n | V0.uv] [V1.xyz | V1.n | V1.uv] ...

索引缓冲:
  [0, 1, 2, 0, 2, 3]  → 两次 drawIndexed 意义上的两个三角形
```

**一句话**：`positions` 定角点在哪，`normals` 定面朝哪（光照），`uvs` 定二维参数怎么铺（草纹），`indices` 定哪三个点围成三角形——四者合起来，才是 GPU 能画的那块草地。

### 8.3 `createGpuMesh`：每块网格一对独立显存缓冲

`geometry.js` 只在 **CPU / 系统内存**里算出 `vertices` 与 `indices`；真正进显存、供 `drawIndexed` 使用，靠的是 `mesh.js` 里的 `createGpuMesh`：

```js
export function createGpuMesh(device, mesh) {
  const vertexBuffer = device.createBuffer({
    size: mesh.vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, mesh.vertices);

  const indexBuffer = device.createBuffer({
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

  return {
    vertexBuffer,
    indexBuffer,
    indexCount: mesh.indices.length,
    layout: VERTEX_LAYOUT,
  };
}
```

三步：

1. **`createBuffer`**：在显存里申请一块**只属于这次调用**的缓冲；  
2. **`writeBuffer`**：把 CPU 上的顶点/索引拷进**这一块**；  
3. **返回句柄**：`vertexBuffer`、`indexBuffer`、`indexCount`，后面画图时拿着引用去绑。

启动时会调用多次：

```js
const groundMesh = createGpuMesh(device, createGround(28));
const characterMesh = createGpuMesh(device, characterGeo);
const weaponMesh = createGpuMesh(device, createWeapon());
const auraMesh = createGpuMesh(device, createAuraRing());
```

 显存里更像：

```text
显存
├─ Buffer A  ← ground 顶点
├─ Buffer B  ← ground 索引
├─ Buffer C  ← character 顶点
├─ Buffer D  ← character 索引
├─ Buffer E  ← weapon 顶点
└─ ...
```

可以类比：不是往一个共享分区里乱写同名文件，而是**每个 mesh 各自一个文件**；用的时候打开对应路径。

#### 未来使用时如何区分？

靠 JS 里保存的**不同 `GPUBuffer` 引用**。画之前 `setVertexBuffer` / `setIndexBuffer` 绑哪对，这次 `drawIndexed` 就只读哪对：

```js
rpass.setVertexBuffer(0, groundMesh.vertexBuffer);
rpass.setIndexBuffer(groundMesh.indexBuffer, "uint16");
rpass.drawIndexed(groundMesh.indexCount);

rpass.setVertexBuffer(0, characterMesh.vertexBuffer); // 换绑人物
rpass.setIndexBuffer(characterMesh.indexBuffer, "uint16");
rpass.drawIndexed(characterMesh.indexCount);
```

`setVertexBuffer` / `setIndexBuffer` 会覆盖当前绑定；下一次 draw 只看**当前绑着的那对 buffer**。草地和人物从未挤在同一块显存里靠偏移硬拆。

若以后要「合批」成一个大缓冲，才需要自己用偏移（`setVertexBuffer(slot, buffer, offset, size)`）在同一块里划区间；当前 demo 没有这样做。
 