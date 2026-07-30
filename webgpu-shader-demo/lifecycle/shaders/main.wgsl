struct Uniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
  color: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
}

@vertex
fn vs_main(@location(0) pos: vec3f) -> VSOut {
  var out: VSOut;
  out.position = u.viewProj * u.model * vec4f(pos, 1.0);
  out.color = u.color.rgb;
  return out;
}

@fragment
fn fs_main(@location(0) color: vec3f) -> @location(0) vec4f {
  return vec4f(color, 1.0);
}
