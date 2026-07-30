struct Uniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
  useInstancing: u32,
  _pad: vec3u,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @location(0) pos: vec3f,
  @location(1) instOffset: vec3f,
  @location(2) instColor: vec4f,
  @builtin(instance_index) instanceIdx: u32,
) -> VSOut {
  var out: VSOut;
  var worldPos = pos;
  var color = instColor;

  if (u.useInstancing == 1u) {
    worldPos = pos + instOffset;
  } else {
    worldPos = (u.model * vec4f(pos, 1.0)).xyz;
    color = instColor;
  }

  out.position = u.viewProj * vec4f(worldPos, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  return in.color;
}
