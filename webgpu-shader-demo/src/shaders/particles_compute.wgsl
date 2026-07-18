struct Particle {
  pos: vec3f,
  life: f32,
  vel: vec3f,
  seed: f32,
}

struct SimParams {
  emitter: vec4f, // xyz position, w unused
  timeDelta: vec4f, // x: dt, y: time, z: particleCount
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

fn hash(n: f32) -> f32 {
  return fract(sin(n * 127.1) * 43758.5453);
}

fn respawn(i: u32, time: f32) -> Particle {
  let s = f32(i) * 17.13 + time * 0.1;
  var p: Particle;
  let rx = hash(s) * 2.0 - 1.0;
  let rz = hash(s + 1.7) * 2.0 - 1.0;
  let ry = hash(s + 3.1);
  p.pos = params.emitter.xyz + vec3f(rx * 0.12, ry * 0.05, rz * 0.12);
  p.vel = vec3f(rx * 0.15, 0.55 + hash(s + 5.0) * 0.55, rz * 0.15);
  p.life = 0.6 + hash(s + 9.0) * 1.4;
  p.seed = hash(s + 11.0);
  return p;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  let count = u32(params.timeDelta.z);
  if (i >= count) {
    return;
  }

  let dt = params.timeDelta.x;
  let time = params.timeDelta.y;
  var p = particles[i];

  p.life -= dt;
  if (p.life <= 0.0) {
    particles[i] = respawn(i, time);
    return;
  }

  // gentle upward drift + swirl
  let swirl = vec3f(
    sin(time * 1.7 + p.seed * 6.28) * 0.08,
    0.0,
    cos(time * 1.3 + p.seed * 4.0) * 0.08
  );
  p.vel += (vec3f(0.0, 0.12, 0.0) + swirl) * dt;
  p.vel *= 0.99;
  p.pos += p.vel * dt;
  particles[i] = p;
}
