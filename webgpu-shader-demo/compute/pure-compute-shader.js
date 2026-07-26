/**
 * WebGPU GPGPU 通用计算示例：对长度为 256 的浮点数组做并行求和。
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
    // 原子累加：多线程安全求和（本示例输入为 0..n-1 的整数，可安全转成 u32）
    atomicAdd(&sumResult, u32(inputArray[idx]));
  }
`;

/**
 * 生成 CPU 侧输入数据：0, 1, 2, ..., n-1。
 * @param {number} count 元素个数
 * @returns {Float32Array}
 */
function createInputData(count) {
  const inputData = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    inputData[i] = i;
  }
  return inputData;
}

/**
 * 创建输入 / 输出 / 回读三类 GPU 缓冲区，并把输入数据写入显存。
 * @param {GPUDevice} device
 * @param {Float32Array} inputData
 * @returns {{ inputBuffer: GPUBuffer, outputBuffer: GPUBuffer, readbackBuffer: GPUBuffer }}
 */
function createBuffers(device, inputData) {
  /** @type {GPUBuffer} 输入缓冲区：CPU 写入，GPU 只读 */
  const inputBuffer = device.createBuffer({
    size: inputData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
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
  // 显式清零，避免未定义初值
  device.queue.writeBuffer(outputBuffer, 0, new Uint32Array([0]));


  /** @type {GPUBuffer} 回读缓冲区：CPU 映射读取 GPU 结果 */
  const readbackBuffer = device.createBuffer({
    size: outputBuffer.size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  return { inputBuffer, outputBuffer, readbackBuffer };
}

/**
 * 创建绑定组布局与绑定组，将缓冲区挂到着色器 binding。
 * @param {GPUDevice} device
 * @param {GPUBuffer} inputBuffer
 * @param {GPUBuffer} outputBuffer
 * @returns {{ bindGroupLayout: GPUBindGroupLayout, bindGroup: GPUBindGroup }}
 */
function createBindGroupResources(device, inputBuffer, outputBuffer) {
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

  return { bindGroupLayout, bindGroup };
}

/**
 * 创建计算管线。
 * @param {GPUDevice} device
 * @param {GPUBindGroupLayout} bindGroupLayout
 * @param {GPUShaderModule} computeModule
 * @returns {GPUComputePipeline}
 */
function createComputePipeline(device, bindGroupLayout, computeModule) {
  return device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: {
      module: computeModule,
      entryPoint: "main",
    },
  });
}

/**
 * 录制并提交计算命令：dispatch 工作组，再把结果拷到回读缓冲。
 * @param {GPUDevice} device
 * @param {GPUComputePipeline} computePipeline
 * @param {GPUBindGroup} bindGroup
 * @param {GPUBuffer} outputBuffer
 * @param {GPUBuffer} readbackBuffer
 * @param {number} workgroupCount 工作组数量
 * @returns {void}
 */
function submitCompute(
  device,
  computePipeline,
  bindGroup,
  outputBuffer,
  readbackBuffer,
  workgroupCount,
) {
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();

  passEncoder.setPipeline(computePipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(workgroupCount);
  passEncoder.end();

  commandEncoder.copyBufferToBuffer(
    outputBuffer,
    0,
    readbackBuffer,
    0,
    outputBuffer.size,
  );

  device.queue.submit([commandEncoder.finish()]);
}

/**
 * 映射回读缓冲区并取出求和结果。
 * @param {GPUBuffer} readbackBuffer
 * @returns {Promise<number>}
 */
async function readGpuSum(readbackBuffer) {
  await readbackBuffer.mapAsync(GPUMapMode.READ);
  // 与着色器 atomic<u32> 对应，按 u32 回读
  const resultArray = new Uint32Array(readbackBuffer.getMappedRange());
  const gpuSum = resultArray[0];
  readbackBuffer.unmap();
  return gpuSum;
}

/**
 * 示例入口：检测 WebGPU → 建缓冲 → 跑计算着色器 → 打印 GPU 求和结果。
 * @returns {Promise<void>}
 */
async function gpuComputeDemo() {
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

  const inputData = createInputData(ELEMENT_COUNT);
  const { inputBuffer, outputBuffer, readbackBuffer } = createBuffers(
    device,
    inputData,
  );

  const computeModule = device.createShaderModule({
    code: COMPUTE_SHADER_CODE,
  });

  const { bindGroupLayout, bindGroup } = createBindGroupResources(
    device,
    inputBuffer,
    outputBuffer,
  );

  const computePipeline = createComputePipeline(
    device,
    bindGroupLayout,
    computeModule,
  );

  const workgroupCount = Math.ceil(ELEMENT_COUNT / WORKGROUP_SIZE);
  submitCompute(
    device,
    computePipeline,
    bindGroup,
    outputBuffer,
    readbackBuffer,
    workgroupCount,
  );

  const gpuSum = await readGpuSum(readbackBuffer);

  document.write(`<p>GPU并行求和结果：${gpuSum}</p>`);
}

gpuComputeDemo();
