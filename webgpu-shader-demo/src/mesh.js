import { VERTEX_LAYOUT } from "./geometry.js";

/**
 * CPU 侧网格数据（来自 geometry.js，如 createGround / createCharacter）。
 * @typedef {object} CpuMesh
 * @property {Float32Array} vertices - 交错顶点：position(3) + normal(3) + uv(2)
 * @property {Uint16Array} indices - 三角形索引
 */

/**
 * 上传到 GPU 后的网格资源。
 * @typedef {object} GpuMesh
 * @property {GPUBuffer} vertexBuffer
 * @property {GPUBuffer} indexBuffer
 * @property {number} indexCount
 * @property {GPUVertexBufferLayout} layout
 */

/**
 * 把 CPU 网格上传为 GPU 顶点/索引缓冲。
 *
 * @param {GPUDevice} device - WebGPU 设备
 * @param {CpuMesh} mesh - 交错顶点与索引数据
 * @returns {GpuMesh}
 */
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

export function createUniformBuffer(device, byteSize) {
  return device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}
