// group(0): 全局 viewProj — 所有物体共享
struct GlobalUniforms {
  viewProj: mat4x4f,
}

// group(1): 每物体 model + 材质色 — 每个 cube 一个 bind group
struct ObjectUniforms {
  model: mat4x4f,
  color: vec4f,
}

@group(0) @binding(0) var<uniform> global: GlobalUniforms;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

struct VSOut {
  @builtin(position) position: vec4f,
}

@vertex
fn vs_main(@location(0) pos: vec3f) -> VSOut {
  var out: VSOut;
  out.position = global.viewProj * object.model * vec4f(pos, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(object.color.rgb, 1.0);
}
