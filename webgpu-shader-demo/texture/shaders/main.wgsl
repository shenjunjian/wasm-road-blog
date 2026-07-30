struct Uniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec3f, @location(1) uv: vec2f) -> VSOut {
  var out: VSOut;
  out.position = u.viewProj * u.model * vec4f(pos, 1.0);
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  return textureSample(tex, samp, in.uv);
}
