/**
 * WebGPU GPGPU 通用计算示例：对长度为 256 的浮点数组做并行求和。
 * 流程按「从上到下」书写，方便初学者顺着读一遍。
 * @module pure-compute-shader
 */

/** @type {number} 输入数组元素个数 */
const ELEMENT_COUNT = 256;

/** @type {number} 计算着色器每个工作组的线程数 */
const WORKGROUP_SIZE = 64;

/**
 * WGSL 计算着色器源码。
 * binding 0：输入数组；binding 1：输出总和。
 * @type {string}
 */
const COMPUTE_SHADER_CODE = `
  // 存储缓冲区绑定：binding=0输入数组，binding=1输出总和
  // atomicAdd 只能作用于 atomic<u32>/atomic<i32>，不能直接对 f32 使用
  @group(0) @binding(0) var<storage, read> inputArray: array<f32>;
  @group(0) @binding(1) var<storage, read_write> sumResult: atomic<u32>;

  // 工作组配置：每组64线程
  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) globalId: vec3u) {
    let idx = globalId.x;
    let totalLen = arrayLength(&inputArray);

    if (idx >= totalLen) {
      return; // 超出数组长度直接返回
    }
    // 【向显存写数据】GPU 侧：原子累加写入 outputBuffer（sumResult）
    atomicAdd(&sumResult, u32(inputArray[idx]));
  }
`;

/**
 * 示例入口：检测 WebGPU → 建缓冲 → 跑计算着色器 → 打印 GPU 求和结果。
 * @returns {Promise<void>}
 */
async function gpuComputeDemo() {
  // ---------- 1. 检测并初始化 WebGPU ----------
  if (!navigator.gpu) {
    alert("当前浏览器不支持 WebGPU，请使用 Chrome 113+/Edge/Firefox 新版");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    alert("无法获取 GPUAdapter");
    return;
  }

  const device = await adapter.requestDevice();
  device.addEventListener("uncapturederror", (event) => {
    console.error("WebGPU uncaptured error:", event.error);
  });

  // ---------- 2. 准备 CPU 侧输入数据：0, 1, 2, ..., n-1 ----------
  const inputData = new Float32Array(ELEMENT_COUNT);
  for (let i = 0; i < ELEMENT_COUNT; i++) {
    inputData[i] = i;
  }

  // ---------- 3. 创建 GPU 缓冲区，并把输入数据写入显存 ----------
  /** @type {GPUBuffer} 输入缓冲区：CPU 写入，GPU 只读 */
  const inputBuffer = device.createBuffer({
    size: inputData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  // 【向显存写数据】CPU → 显存：上传输入数组到 inputBuffer
  device.queue.writeBuffer(inputBuffer, 0, inputData);

  /** @type {GPUBuffer} 输出缓冲区：GPU 读写，最后拷贝回 CPU（atomic<u32>） */
  const outputBuffer = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT,
    // COPY_DST：允许 writeBuffer 清零；COPY_SRC：拷到 readback
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });
  // 【向显存写数据】CPU → 显存：把 outputBuffer 初值清零
  device.queue.writeBuffer(outputBuffer, 0, new Uint32Array([0]));

  /** @type {GPUBuffer} 回读缓冲区：CPU 映射读取 GPU 结果 */
  const readbackBuffer = device.createBuffer({
    size: outputBuffer.size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // ---------- 4. 创建着色器模块 ----------
  const computeModule = device.createShaderModule({
    code: COMPUTE_SHADER_CODE,
  });

  // ---------- 5. 创建绑定组布局与绑定组，将缓冲区挂到着色器 binding ----------
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
    ],
  });

  // ---------- 6. 创建计算管线 ----------
  const computePipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: {
      module: computeModule,
      entryPoint: "main",
    },
  });

  // ---------- 7. 录制并提交计算命令 ----------
  const workgroupCount = Math.ceil(ELEMENT_COUNT / WORKGROUP_SIZE);
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();

  // setPipeline / setBindGroup 属于配置命令，不是数据上传；
  passEncoder.setPipeline(computePipeline);
  // bindGroup 里挂的是 buffer 句柄/引用，不是要把整份数据再传一遍。
  // 数据早在上面的 writeBuffer 就已经进显存了；
  // setBindGroup 只是把「资源槽位 → buffer」的对应关系记进当前 compute pass 的命令流里。
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(workgroupCount);
  passEncoder.end();

  // 【向显存写数据】GPU → GPU：把 outputBuffer 拷到 readbackBuffer
  commandEncoder.copyBufferToBuffer(
    outputBuffer,
    0,
    readbackBuffer,
    0,
    outputBuffer.size,
  );

  device.queue.submit([commandEncoder.finish()]);

  // ---------- 8. 映射回读缓冲区，取出求和结果 ----------
  await readbackBuffer.mapAsync(GPUMapMode.READ);
  // 与着色器 atomic<u32> 对应，按 u32 回读
  const resultArray = new Uint32Array(readbackBuffer.getMappedRange());
  const gpuSum = resultArray[0];
  readbackBuffer.unmap();

  document.write(`<p>GPU并行求和结果：${gpuSum}</p>`);
}

gpuComputeDemo();
