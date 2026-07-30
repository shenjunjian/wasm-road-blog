struct PostParams {
  texelSize: vec2f,
  _pad: vec2f,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var<uniform> params: PostParams;

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

@fragment fn fs_copy(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(srcTex, srcSampler, uv);
}

@fragment fn fs_extract(@location(0) uv: vec2f) -> @location(0) vec4f {
  let c = textureSample(srcTex, srcSampler, uv);
  let threshold = vec3f(0.75);
  let bright = max(c.rgb - threshold, vec3f(0.0));
  return vec4f(bright, 1.0);
}

@fragment fn fs_blur_h(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ts = params.texelSize;
  var sum = vec3f(0.0);
  sum += textureSample(srcTex, srcSampler, uv + vec2f(-2.0, 0.0) * ts).rgb * 0.0625;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(-1.0, 0.0) * ts).rgb * 0.125;
  sum += textureSample(srcTex, srcSampler, uv).rgb * 0.25;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(1.0, 0.0) * ts).rgb * 0.125;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(2.0, 0.0) * ts).rgb * 0.0625;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(-3.0, 0.0) * ts).rgb * 0.03125;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(3.0, 0.0) * ts).rgb * 0.03125;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(-4.0, 0.0) * ts).rgb * 0.015625;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(4.0, 0.0) * ts).rgb * 0.015625;
  return vec4f(sum, 1.0);
}

@fragment fn fs_blur_v(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ts = params.texelSize;
  var sum = vec3f(0.0);
  sum += textureSample(srcTex, srcSampler, uv + vec2f(0.0, -2.0) * ts).rgb * 0.0625;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(0.0, -1.0) * ts).rgb * 0.125;
  sum += textureSample(srcTex, srcSampler, uv).rgb * 0.25;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(0.0, 1.0) * ts).rgb * 0.125;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(0.0, 2.0) * ts).rgb * 0.0625;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(0.0, -3.0) * ts).rgb * 0.03125;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(0.0, 3.0) * ts).rgb * 0.03125;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(0.0, -4.0) * ts).rgb * 0.015625;
  sum += textureSample(srcTex, srcSampler, uv + vec2f(0.0, 4.0) * ts).rgb * 0.015625;
  return vec4f(sum, 1.0);
}
