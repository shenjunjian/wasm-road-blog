struct Uniforms {
  viewProj: mat4x4f,
  bone0: mat4x4f,
  bone1: mat4x4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}

@vertex
fn vs_main(
  @location(0) pos: vec3f,
  @location(1) normal: vec3f,
  @location(2) boneIdx: vec2f,
  @location(3) boneWeight: vec2f,
) -> VSOut {
  let i0 = u32(boneIdx.x + 0.5);
  let i1 = u32(boneIdx.y + 0.5);
  let w0 = boneWeight.x;
  let w1 = boneWeight.y;

  var skinned = vec3f(0.0);
  var nrm = vec3f(0.0);

  if (i0 == 0u) {
    skinned += w0 * (u.bone0 * vec4f(pos, 1.0)).xyz;
    nrm += w0 * (u.bone0 * vec4f(normal, 0.0)).xyz;
  } else {
    skinned += w0 * (u.bone1 * vec4f(pos, 1.0)).xyz;
    nrm += w0 * (u.bone1 * vec4f(normal, 0.0)).xyz;
  }

  if (i1 == 0u) {
    skinned += w1 * (u.bone0 * vec4f(pos, 1.0)).xyz;
    nrm += w1 * (u.bone0 * vec4f(normal, 0.0)).xyz;
  } else {
    skinned += w1 * (u.bone1 * vec4f(pos, 1.0)).xyz;
    nrm += w1 * (u.bone1 * vec4f(normal, 0.0)).xyz;
  }

  var out: VSOut;
  out.position = u.viewProj * vec4f(skinned, 1.0);
  out.normal = normalize(nrm);
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let lightDir = normalize(vec3f(0.4, 0.8, 0.5));
  let ndl = max(dot(normalize(in.normal), lightDir), 0.15);
  let base = vec3f(0.55, 0.72, 0.95);
  return vec4f(base * ndl, 1.0);
}
