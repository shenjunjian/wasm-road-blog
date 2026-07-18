struct Uniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
  params: vec4f, // x: time, y: pulse
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) normal: vec3f,
}

@vertex
fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
) -> VSOut {
  var out: VSOut;
  let pulse = 1.0 + 0.06 * sin(u.params.y * 4.0 + uv.x * 6.283);
  let pos = position * vec3f(pulse, 1.0, pulse);
  let world = u.model * vec4f(pos, 1.0);
  out.position = u.viewProj * world;
  out.uv = uv;
  out.normal = normalize((u.model * vec4f(normal, 0.0)).xyz);
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let time = u.params.x;
  let flowU = fract(in.uv.x - time * 0.55);
  let band = smoothstep(0.0, 0.15, flowU) * smoothstep(1.0, 0.7, flowU);
  let noise = sin(in.uv.x * 40.0 + time * 5.0) * sin(in.uv.y * 18.0 - time * 3.0);
  let n = 0.55 + 0.45 * noise;
  let rim = pow(1.0 - abs(in.uv.y - 0.5) * 2.0, 1.6);
  let intensity = band * n * rim;
  let rgb = vec3f(0.2, 0.65, 1.0) * intensity * 1.8
    + vec3f(0.55, 0.9, 1.0) * intensity * intensity;
  let alpha = clamp(intensity * 0.85, 0.0, 0.9);
  return vec4f(rgb, alpha);
}
