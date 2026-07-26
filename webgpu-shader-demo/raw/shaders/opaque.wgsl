// =============================================================================
// opaque.wgsl — 不透明物体共用一份 shader（草地 / 人物 / 武器）
//
// 一份模块里同时有 @vertex 与 @fragment；createRenderPipeline 用 entryPoint
// 分别点名 vs_main / fs_main。材质差异靠 uniform.params.x（materialKind）分支。
// =============================================================================

// CPU 每帧 writeBuffer 写入的常量块；布局必须与 JS 侧 Float32Array 打包一致。
struct Uniforms {
  viewProj: mat4x4f, // 相机：世界 → 裁剪空间
  model: mat4x4f,    // 物体：局部 → 世界
  lightDir: vec4f,   // xyz = 光照方向（指向光源的反方向约定见 FS）
  tint: vec4f,       // rgb 基色（人物/武器可作调色；草地主要走程序化色）
  params: vec4f,     // x: materialKind (0 草地, 1 人物, 2 武器), y: time
}

// group(0) = 第 0 套 bind group；binding(0) = 组内第 0 号槽。
// var<uniform>：只读、按 uniform 地址空间对齐的常量缓冲。
@group(0) @binding(0) var<uniform> u: Uniforms;

// 顶点着色器 → 片元着色器 的「插值载荷」。
// @builtin(position) 交给光栅化做裁剪/视口变换；其余 @location 会按透视校正插值后进 FS。
struct VSOut {
  @builtin(position) position: vec4f, // 裁剪空间齐次坐标（必须）
  @location(0) worldPos: vec3f,       // 世界坐标（草地噪声、人物按高度分色）
  @location(1) normal: vec3f,         // 世界空间法线（漫反射）
  @location(2) uv: vec2f,             // 纹理/程序化参数域
}

// ---------------------------------------------------------------------------
// 顶点着色器：每个顶点跑一次
// 入参 @location(n) 与 VERTEX_LAYOUT 里 attributes.shaderLocation 一一对应。
// ---------------------------------------------------------------------------
@vertex
fn vs_main(
  @location(0) position: vec3f, // 局部位置
  @location(1) normal: vec3f,   // 局部法线
  @location(2) uv: vec2f,       // UV
) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4f(position, 1.0); // w=1：点
  out.worldPos = world.xyz;
  out.position = u.viewProj * world;
  // w=0：向量，不受平移；再归一化，避免非均匀缩放拉歪光照
  out.normal = normalize((u.model * vec4f(normal, 0.0)).xyz);
  out.uv = uv;
  return out;
}

// 2D 哈希：把格子坐标打散成 [0,1) 伪随机，用于草地斑驳
fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ---------------------------------------------------------------------------
// 片元着色器：每个被三角形盖住的像素候选跑一次
// 入参是插值后的 VSOut；返回 @location(0) 写入颜色附件（与 targets[0] 对应）。
// ---------------------------------------------------------------------------
@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let n = normalize(in.normal);           // 插值后再归一化
  let l = normalize(-u.lightDir.xyz);     // 指向光源
  let ndotl = max(dot(n, l), 0.0);        // 朗伯漫反射项
  let ambient = 0.28;
  let diff = ambient + ndotl * 0.72;
  let kind = u.params.x;
  let time = u.params.y;

  var base = u.tint.rgb;

  if (kind < 0.5) {
    // —— 草地：程序化格子噪声，不采样贴图 ——
    let cell = floor(in.uv * 18.0);
    let h = hash21(cell);
    let blade = mix(0.75, 1.15, h);
    let stripe = 0.85 + 0.15 * sin(in.worldPos.x * 7.0 + in.worldPos.z * 5.0);
    base = vec3f(0.22, 0.48, 0.18) * blade * stripe;
    base = mix(base, vec3f(0.35, 0.55, 0.2), smoothstep(0.6, 1.0, h) * 0.35);
  } else if (kind < 1.5) {
    // —— 人物：按世界高度分皮肤 / 衣服 / 靴 ——
    let y = in.worldPos.y;
    if (y > 1.4) {
      base = vec3f(0.86, 0.7, 0.58);
    } else if (y > 0.75) {
      base = vec3f(0.25, 0.38, 0.62);
    } else {
      base = vec3f(0.2, 0.22, 0.28);
    }
  } else {
    // —— 武器：Blinn-Phong 高光 + 边缘冷色呼吸 ——
    let halfV = normalize(l + normalize(vec3f(0.4, 0.8, 0.5)));
    let spec = pow(max(dot(n, halfV), 0.0), 48.0);
    base = vec3f(0.55, 0.58, 0.65) * diff + vec3f(0.7, 0.85, 1.0) * spec;
    let edge = pow(1.0 - max(dot(n, normalize(vec3f(0.2, 0.9, 0.3))), 0.0), 2.0);
    base += vec3f(0.1, 0.25, 0.45) * edge * (0.5 + 0.5 * sin(time * 3.0));
    return vec4f(base, 1.0); // 金属分支已含 diff，直接返回
  }

  return vec4f(base * diff, 1.0);
}
