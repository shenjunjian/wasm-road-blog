struct Uniforms {
  lightViewProj: mat4x4f,
  model: mat4x4f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex fn vs_shadow(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return u.lightViewProj * u.model * vec4f(position, 1.0);
}

@fragment fn fs_shadow() {}
