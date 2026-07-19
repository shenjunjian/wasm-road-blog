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
