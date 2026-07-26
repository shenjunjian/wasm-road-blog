// =============================================================================
// particles_render.wgsl — 粒子广告牌渲染（半透明批次）
//
// 无顶点缓冲：用 instance_index 读 Storage 里的粒子，用 vertex_index 展开
// 单位四边形，再按相机 right/up 做成 billboard。depthWrite 关 + blend 开。
// =============================================================================

// 与 particles_compute.wgsl 中 Particle 布局必须一致（同一 StorageBuffer）。
struct Particle {
  pos: vec3f,
  life: f32,
  vel: vec3f,  // 渲染未用，保留与仿真结构对齐
  seed: f32,
}

// 每帧相机与时间；CPU writeBuffer。
struct Frame {
  viewProj: mat4x4f,
  cameraRight: vec4f, // xyz = 相机右向量（世界），用于广告牌横轴
  cameraUp: vec4f,    // xyz = 相机上向量（世界），用于广告牌纵轴
  params: vec4f,      // x: time（本 FS 未用，预留）
}

// read：只读仿真结果；勿与 compute 同 pass 冲突写。
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> frame: Frame;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,  // 面片 [0,1]²，FS 画径向光斑
  @location(1) life: f32,  // 已做淡入淡出的寿命权重
  @location(2) seed: f32,  // 色相混合
}

// ---------------------------------------------------------------------------
// 顶点着色器：draw(6, particleCount) —— 每实例 6 顶点 = 两个三角形
// ---------------------------------------------------------------------------
@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,     // 0..5：面片角点
  @builtin(instance_index) iid: u32,   // 粒子下标
) -> VSOut {
  // 单位四边形角点（NDC 风格局部坐标，后乘 size）
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
  let size = 0.04 + p.seed * 0.03; // 每粒子略有大小差
  // 寿命两端衰减：刚出生 / 将死时变淡
  let fade = clamp(p.life / 0.35, 0.0, 1.0) * clamp(p.life, 0.0, 1.0);
  // 广告牌：中心 + right*x*size + up*y*size，始终朝向相机平面
  let world =
    p.pos
    + frame.cameraRight.xyz * corner.x * size
    + frame.cameraUp.xyz * corner.y * size;

  var out: VSOut;
  out.position = frame.viewProj * vec4f(world, 1.0);
  out.uv = corner * 0.5 + vec2f(0.5); // [-1,1] → [0,1]
  out.life = fade;
  out.seed = p.seed;
  return out;
}

// ---------------------------------------------------------------------------
// 片元着色器：软圆光斑；seed 在青白 ↔ 暖黄间插值
// ---------------------------------------------------------------------------
@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let d = length(in.uv - vec2f(0.5));           // 距中心
  let glow = smoothstep(0.5, 0.05, d);          // 边缘软切
  let spark = glow * glow;                      // 中心更亮
  let hue = mix(vec3f(0.55, 0.85, 1.0), vec3f(1.0, 0.9, 0.55), in.seed);
  let rgb = hue * spark * (1.2 + in.life);
  let alpha = glow * in.life * 0.85;
  return vec4f(rgb, alpha);
}
