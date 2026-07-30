struct SceneUniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
  lightViewProj: mat4x4f,
  lightDir: vec4f,
  albedo: vec4f,
  shadowMode: u32,
  _pad: vec3u,
};

@group(0) @binding(0) var<uniform> u: SceneUniforms;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
};

@vertex fn vs_main(@location(0) position: vec3f, @location(1) normal: vec3f) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4f(position, 1.0);
  out.pos = u.viewProj * world;
  out.worldPos = world.xyz;
  out.normal = normalize((u.model * vec4f(normal, 0.0)).xyz);
  return out;
}

fn calcShadow(worldPos: vec3f) -> f32 {
  if (u.shadowMode == 0u) {
    return 1.0;
  }
  let lightClip = u.lightViewProj * vec4f(worldPos, 1.0);
  let ndc = lightClip.xyz / lightClip.w;
  var uv = ndc.xy * 0.5 + 0.5;
  uv.y = 1.0 - uv.y;
  let depth = ndc.z;
  let bias = 0.0025;
  if (u.shadowMode == 1u) {
    return textureSampleCompare(shadowMap, shadowSampler, uv, depth - bias);
  }
  var sum = 0.0;
  let texel = 1.0 / 2048.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let offset = vec2f(f32(x), f32(y)) * texel;
      sum += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth - bias);
    }
  }
  return sum / 9.0;
}

@fragment fn fs_main(@location(0) worldPos: vec3f, @location(1) normal: vec3f) -> @location(0) vec4f {
  let n = normalize(normal);
  let l = normalize(-u.lightDir.xyz);
  let ndotl = max(dot(n, l), 0.0);
  let ambient = 0.18;
  let shadow = calcShadow(worldPos);
  let lit = ambient + ndotl * shadow * 0.82;
  return vec4f(u.albedo.rgb * lit, 1.0);
}
