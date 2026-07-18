struct Uniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
  lightDir: vec4f,
  tint: vec4f,
  params: vec4f, // x: materialKind (0 ground, 1 character, 2 weapon), y: time
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
}

@vertex
fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4f(position, 1.0);
  out.worldPos = world.xyz;
  out.position = u.viewProj * world;
  out.normal = normalize((u.model * vec4f(normal, 0.0)).xyz);
  out.uv = uv;
  return out;
}

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let n = normalize(in.normal);
  let l = normalize(-u.lightDir.xyz);
  let ndotl = max(dot(n, l), 0.0);
  let ambient = 0.28;
  let diff = ambient + ndotl * 0.72;
  let kind = u.params.x;
  let time = u.params.y;

  var base = u.tint.rgb;

  if (kind < 0.5) {
    // grass
    let cell = floor(in.uv * 18.0);
    let h = hash21(cell);
    let blade = mix(0.75, 1.15, h);
    let stripe = 0.85 + 0.15 * sin(in.worldPos.x * 7.0 + in.worldPos.z * 5.0);
    base = vec3f(0.22, 0.48, 0.18) * blade * stripe;
    base = mix(base, vec3f(0.35, 0.55, 0.2), smoothstep(0.6, 1.0, h) * 0.35);
  } else if (kind < 1.5) {
    // character cloth / skin tones by height
    let y = in.worldPos.y;
    if (y > 1.4) {
      base = vec3f(0.86, 0.7, 0.58);
    } else if (y > 0.75) {
      base = vec3f(0.25, 0.38, 0.62);
    } else {
      base = vec3f(0.2, 0.22, 0.28);
    }
  } else {
    // weapon metal
    let halfV = normalize(l + normalize(vec3f(0.4, 0.8, 0.5)));
    let spec = pow(max(dot(n, halfV), 0.0), 48.0);
    base = vec3f(0.55, 0.58, 0.65) * diff + vec3f(0.7, 0.85, 1.0) * spec;
    let edge = pow(1.0 - max(dot(n, normalize(vec3f(0.2, 0.9, 0.3))), 0.0), 2.0);
    base += vec3f(0.1, 0.25, 0.45) * edge * (0.5 + 0.5 * sin(time * 3.0));
    return vec4f(base, 1.0);
  }

  return vec4f(base * diff, 1.0);
}
