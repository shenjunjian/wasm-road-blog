@group(0) @binding(0) var sceneTex: texture_2d<f32>;
@group(0) @binding(1) var bloomTex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs_fullscreen(@location(0) pos: vec2f) -> VSOut {
  var out: VSOut;
  out.pos = vec4f(pos, 0.0, 1.0);
  out.uv = vec2f(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  return out;
}

@fragment fn fs_composite(@location(0) uv: vec2f) -> @location(0) vec4f {
  let scene = textureSample(sceneTex, samp, uv);
  let bloom = textureSample(bloomTex, samp, uv);
  return vec4f(scene.rgb + bloom.rgb * 1.4, 1.0);
}
