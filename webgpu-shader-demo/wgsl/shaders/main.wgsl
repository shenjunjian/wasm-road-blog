struct Params {
  effect: u32,
  time: f32,
  aspect: f32,
  _pad: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f) -> VSOut {
  var out: VSOut;
  out.position = vec4f(pos, 0.0, 1.0);
  out.uv = pos * 0.5 + vec2f(0.5);
  return out;
}

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(p.xyx * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn valueNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var amp = 0.5;
  var f = p;
  for (var i = 0; i < 4; i++) {
    v += valueNoise(f) * amp;
    f *= 2.0;
    amp *= 0.5;
  }
  return v;
}

fn effectGradient(uv: vec2f) -> vec3f {
  let t = params.time * 0.25;
  let c1 = vec3f(0.15, 0.35, 0.85);
  let c2 = vec3f(0.85, 0.25, 0.55);
  let c3 = vec3f(0.2, 0.75, 0.65);
  let m = 0.5 + 0.5 * sin(vec3f(uv.x * 6.0 + t, uv.y * 5.0 - t, uv.x + uv.y + t * 2.0));
  return mix(mix(c1, c2, uv.x), c3, uv.y);
}

fn effectNoise(uv: vec2f) -> vec3f {
  let p = uv * 4.0 + vec2f(params.time * 0.15, -params.time * 0.1);
  let n = fbm(p);
  let col = mix(vec3f(0.08, 0.12, 0.22), vec3f(0.55, 0.75, 0.95), n);
  return col * (0.85 + 0.15 * sin(params.time + n * 10.0));
}

fn effectRings(uv: vec2f) -> vec3f {
  var p = uv - vec2f(0.5);
  p.x *= params.aspect;
  let r = length(p);
  let wave = sin(r * 40.0 - params.time * 3.0);
  let band = smoothstep(0.02, 0.0, abs(fract(r * 8.0 - params.time * 0.5) - 0.5) - 0.08);
  let core = exp(-r * 3.5);
  let col = mix(vec3f(0.1, 0.15, 0.25), vec3f(0.4, 0.85, 1.0), 0.5 + 0.5 * wave);
  return col * (0.35 + band * 0.65 + core * 0.4);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color: vec3f;
  switch params.effect {
    case 0u: { color = effectGradient(uv); }
    case 1u: { color = effectNoise(uv); }
    default: { color = effectRings(uv); }
  }
  return vec4f(color, 1.0);
}
