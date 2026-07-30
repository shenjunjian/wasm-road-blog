struct Uniforms {
  viewProj: mat4x4f,
  model: mat4x4f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
};

@vertex fn vs_main(@location(0) position: vec3f, @location(1) color: vec4f) -> VSOut {
  var out: VSOut;
  out.pos = u.viewProj * u.model * vec4f(position, 1.0);
  out.color = color;
  return out;
}

@fragment fn fs_main(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}
