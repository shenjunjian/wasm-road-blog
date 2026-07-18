import { VERTEX_LAYOUT } from "./geometry.js";

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
