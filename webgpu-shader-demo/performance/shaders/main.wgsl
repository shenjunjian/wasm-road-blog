struct GlobalUniforms {
  viewProj: mat4x4f,
}

struct ObjectUniforms {
  model: mat4x4f,
  color: vec4f,
}

@group(0) @binding(0) var<uniform> global: GlobalUniforms;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
}

@vertex
fn vs_batch(@location(0) pos: vec3f) -> VSOut {
  var out: VSOut;
  out.position = global.viewProj * object.model * vec4f(pos, 1.0);
  out.color = object.color.rgb;
  return out;
}

@vertex
fn vs_instanced(
  @location(0) pos: vec3f,
  @location(1) i0: vec4f,
  @location(2) i1: vec4f,
  @location(3) i2: vec4f,
  @location(4) i3: vec4f,
  @builtin(instance_index) i: u32,
) -> VSOut {
  let model = mat4x4f(i0, i1, i2, i3);
  var out: VSOut;
  out.position = global.viewProj * model * vec4f(pos, 1.0);
  let hue = f32(i) / 500.0;
  out.color = vec3f(0.35 + hue * 0.55, 0.45, 0.85 - hue * 0.35);
  return out;
}

@fragment
fn fs_main(@location(0) color: vec3f) -> @location(0) vec4f {
  return vec4f(color, 1.0);
}
