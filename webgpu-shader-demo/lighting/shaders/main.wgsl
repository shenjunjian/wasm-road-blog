struct SceneUniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
  lightDir: vec4f,
  cameraPos: vec4f,
  params: vec4f, // x: mode 0 ambient, 1 diffuse, 2 specular
}

@group(0) @binding(0) var<uniform> u: SceneUniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) worldPos: vec3f,
}

@vertex
fn vs_main(@location(0) pos: vec3f, @location(1) normal: vec3f) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4f(pos, 1.0);
  out.worldPos = world.xyz;
  out.position = u.viewProj * world;
  out.normal = normalize((u.model * vec4f(normal, 0.0)).xyz);
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let n = normalize(in.normal);
  let l = normalize(-u.lightDir.xyz);
  let v = normalize(u.cameraPos.xyz - in.worldPos);
  let ndotl = max(dot(n, l), 0.0);
  let halfV = normalize(l + v);
  let spec = pow(max(dot(n, halfV), 0.0), 64.0);
  let base = vec3f(0.45, 0.55, 0.85);
  let mode = u.params.x;
  var color = base * 0.15;
  if (mode >= 0.5) { color += base * ndotl * 0.85; }
  if (mode >= 1.5) { color += vec3f(1.0) * spec * 0.6; }
  return vec4f(color, 1.0);
}
