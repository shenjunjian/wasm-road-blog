// =============================================================================
// particles_compute.wgsl — 粒子仿真（Compute Pass，先于渲染提交）
//
// 在 GPU 上直接改 StorageBuffer：寿命衰减 → 死亡重生 → 速度/位置积分。
// 不必每帧把整表读回 CPU；渲染侧 particles_render.wgsl 只读同一缓冲。
// =============================================================================

// 单粒子状态；vec3 + f32 交错，满足 16 字节对齐习惯。
// 布局必须与 JS 侧创建 StorageBuffer / 渲染 shader 的 Particle 一致。
struct Particle {
  pos: vec3f,  // 世界位置
  life: f32,   // 剩余寿命（秒）；≤0 时本帧 respawn
  vel: vec3f,  // 世界速度
  seed: f32,   // [0,1) 稳定随机：尺寸、色相、涡旋相位
}

// 发射器与时间步；CPU 每帧 writeBuffer。
struct SimParams {
  emitter: vec4f,   // xyz = 发射点（如头顶世界坐标），w 未用
  timeDelta: vec4f, // x: dt, y: time, z: particleCount（有效粒子数）
}

// read_write：本 pass 读写；与渲染 pass 的 read-only 绑定同一物理缓冲。
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

// 廉价 1D 哈希 → [0,1)；用不同偏移造独立随机流。
fn hash(n: f32) -> f32 {
  return fract(sin(n * 127.1) * 43758.5453);
}

// 在发射器附近重生一颗：随机水平扩散 + 向上初速 + 寿命。
fn respawn(i: u32, time: f32) -> Particle {
  let s = f32(i) * 17.13 + time * 0.1; // 索引 + 时间，避免每帧同种子
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

// ---------------------------------------------------------------------------
// 入口：每个 workgroup 64 线程；全局 id.x 即粒子下标
// dispatch 时 workgroup 数 = ceil(count / 64)，多出来的线程靠边界检查退出。
// ---------------------------------------------------------------------------
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

  // 轻微上浮 + 按 seed 错开的水平涡旋；再阻尼与欧拉积分
  let swirl = vec3f(
    sin(time * 1.7 + p.seed * 6.28) * 0.08,
    0.0,
    cos(time * 1.3 + p.seed * 4.0) * 0.08
  );
  p.vel += (vec3f(0.0, 0.12, 0.0) + swirl) * dt;
  p.vel *= 0.99;           // 速度衰减，避免无限加速
  p.pos += p.vel * dt;
  particles[i] = p;
}
