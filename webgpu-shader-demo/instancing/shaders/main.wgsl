struct Uniforms {
  viewProj: mat4x4f,  // offset 0,  64 bytes
  model: mat4x4f,     // offset 64, 64 bytes
  useInstancing: u32, // offset 128
  // vec3 对齐是 16：写成 _pad: vec3u 会先空出 12 字节再放 vec3，整结构变成 160。
  // 三个 u32 才能填满 128..143，与 JS 侧 144 字节 uniform 一致。
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @location(0) pos: vec3f,
  @location(1) instOffset: vec3f,
  @location(2) instColor: vec4f,
  @builtin(instance_index) instanceIdx: u32,
) -> VSOut {
  var out: VSOut;
  var worldPos = pos;
  var color = instColor;

  if (u.useInstancing == 1u) {
    worldPos = pos + instOffset;
  } else {
    worldPos = (u.model * vec4f(pos, 1.0)).xyz;
    color = instColor;
  }

  out.position = u.viewProj * vec4f(worldPos, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  return in.color;
}
