// 场景 Uniform：变换矩阵 + 光照参数
struct SceneUniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
  lightDir: vec4f,   // 光源方向（世界空间，指向光源）；CPU 侧每帧绕 Y 轴旋转
  cameraPos: vec4f,  // 相机位置（世界空间），用于计算视线 V
  params: vec4f,     // x: 光照模式 0=仅环境光, 1=+漫反射, 2=+高光
}

@group(0) @binding(0) var<uniform> u: SceneUniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,   // 世界空间法线，供 FS 光照计算
  @location(1) worldPos: vec3f,   // 世界空间位置，用于 V = camera - worldPos
}

@vertex
fn vs_main(@location(0) pos: vec3f, @location(1) normal: vec3f) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4f(pos, 1.0);
  out.worldPos = world.xyz;
  out.position = u.viewProj * world;
  // w=0 去掉平移，只保留旋转/缩放；八面体仅旋转，无需逆转置
  out.normal = normalize((u.model * vec4f(normal, 0.0)).xyz);
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  // ── 光照向量（均须归一化）────────────────────────────────────
  let n = normalize(in.normal);                    // N：表面法线
  let l = normalize(-u.lightDir.xyz);              // L：指向光源（lightDir 存的是光传播方向，取反）
  let v = normalize(u.cameraPos.xyz - in.worldPos); // V：指向相机（视线方向）

  // ── Lambert 漫反射 ───────────────────────────────────────────
  // 受光强度 ∝ cos(θ)，θ 为 N 与 L 夹角；背光面 clamp 到 0
  let ndotl = max(dot(n, l), 0.0);

  // ── Blinn-Phong 高光 ─────────────────────────────────────────
  // 半角向量 H = normalize(L + V)，比经典 Phong 用反射向量更稳定
  // pow(..., 64) 控制高光锐度：指数越大光斑越小越亮
  let halfV = normalize(l + v);
  let spec = pow(max(dot(n, halfV), 0.0), 64.0);

  // ── 三项叠加（由 params.x 分步开启，便于调试）────────────────
  let base = vec3f(0.45, 0.55, 0.85); // 物体固有色（此处无贴图，用常量代替 albedo）
  let mode = u.params.x;

  var color = base * 0.4;                        // Ambient：模拟间接光，避免背光全黑
  if (mode >= 0.5) { color += base * ndotl * 0.85; } // Diffuse：base × kd × max(N·L, 0)
  if (mode >= 1.5) { color += vec3f(1.0) * spec * 0.6; } // Specular：ks × pow(max(N·H, 0), shininess)

  return vec4f(color, 1.0);
}
