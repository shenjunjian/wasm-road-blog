struct Particle {
  pos: vec3f,
  life: f32,
  vel: vec3f,
  seed: f32,
}

struct Frame {
  viewProj: mat4x4f,
  cameraRight: vec4f,
  cameraUp: vec4f,
  params: vec4f, // x: time
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> frame: Frame;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) life: f32,
  @location(2) seed: f32,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VSOut {
  // unit quad corners
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, 1.0)
  );
  let corner = corners[vid];
  let p = particles[iid];
  let size = 0.04 + p.seed * 0.03;
  let fade = clamp(p.life / 0.35, 0.0, 1.0) * clamp(p.life, 0.0, 1.0);
  let world =
    p.pos
    + frame.cameraRight.xyz * corner.x * size
    + frame.cameraUp.xyz * corner.y * size;

  var out: VSOut;
  out.position = frame.viewProj * vec4f(world, 1.0);
  out.uv = corner * 0.5 + vec2f(0.5);
  out.life = fade;
  out.seed = p.seed;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let d = length(in.uv - vec2f(0.5));
  let glow = smoothstep(0.5, 0.05, d);
  let spark = glow * glow;
  let hue = mix(vec3f(0.55, 0.85, 1.0), vec3f(1.0, 0.9, 0.55), in.seed);
  let rgb = hue * spark * (1.2 + in.life);
  let alpha = glow * in.life * 0.85;
  return vec4f(rgb, alpha);
}
