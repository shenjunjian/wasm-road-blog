// =============================================================================
// aura.wgsl — 武器周围半透明法术光环（圆柱 / 环状网格）
//
// 与 opaque 分开：depthWrite 关、blend 开。环在剑身外，靠独立几何覆盖像素，
// 不是把武器片元「画大一点」。model 与武器绑在一起，视觉上贴着剑飘。
// =============================================================================

// CPU 每帧 writeBuffer；布局须与 JS Float32Array 打包一致。
struct Uniforms {
  viewProj: mat4x4f, // 相机：世界 → 裁剪
  model: mat4x4f,    // 环：局部 → 世界（通常跟武器）
  params: vec4f,     // x: time, y: pulse（呼吸/缩放相位）
}

@group(0) @binding(0) var<uniform> u: Uniforms;

// VS → FS 插值载荷；@builtin(position) 供光栅化，其余 @location 透视校正后进 FS。
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,     // 环面参数域：u 绕周长，v 沿高度
  @location(1) normal: vec3f, // 世界法线（本 FS 主要用 uv，保留扩展）
}

// ---------------------------------------------------------------------------
// 顶点着色器：按 UV 做径向脉冲，让环沿 XZ「呼吸」
// ---------------------------------------------------------------------------
@vertex
fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
) -> VSOut {
  var out: VSOut;
  // 沿周长相位错开：整圈不是同步胀缩，更像流动能量
  let pulse = 1.0 + 0.06 * sin(u.params.y * 4.0 + uv.x * 6.283);
  let pos = position * vec3f(pulse, 1.0, pulse); // 只缩放 XZ，高度不动
  let world = u.model * vec4f(pos, 1.0);
  out.position = u.viewProj * world;
  out.uv = uv;
  out.normal = normalize((u.model * vec4f(normal, 0.0)).xyz); // w=0：方向向量
  return out;
}

// ---------------------------------------------------------------------------
// 片元着色器：程序化流光带 + 噪声 + 上下边缘羽化 → 半透明青色光
// ---------------------------------------------------------------------------
@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let time = u.params.x;
  // 沿 u 滚动的亮带；fract 做周期环绕
  let flowU = fract(in.uv.x - time * 0.55);
  let band = smoothstep(0.0, 0.15, flowU) * smoothstep(1.0, 0.7, flowU);
  // 可分离正弦积：廉价「噪声」闪烁
  let noise = sin(in.uv.x * 40.0 + time * 5.0) * sin(in.uv.y * 18.0 - time * 3.0);
  let n = 0.55 + 0.45 * noise;
  // 环高度中心亮、上下缘收束（v≈0.5 最强）
  let rim = pow(1.0 - abs(in.uv.y - 0.5) * 2.0, 1.6);
  let intensity = band * n * rim;
  // 主色 + 平方项高光，略偏青白
  let rgb = vec3f(0.2, 0.65, 1.0) * intensity * 1.8
    + vec3f(0.55, 0.9, 1.0) * intensity * intensity;
  let alpha = clamp(intensity * 0.85, 0.0, 0.9);
  return vec4f(rgb, alpha);
}
