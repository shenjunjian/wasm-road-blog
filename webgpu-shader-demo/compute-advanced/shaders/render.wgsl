const GRID: u32 = 128u;

struct RenderParams {
  aliveColor: vec4f,
  deadColor: vec4f,
}

@group(0) @binding(0) var<storage, read> cells: array<u32>;
@group(0) @binding(1) var<uniform> params: RenderParams;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VSOut {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );
  var out: VSOut;
  let p = pos[vi];
  out.position = vec4f(p, 0.0, 1.0);
  out.uv = p * 0.5 + 0.5;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let x = u32(in.uv.x * f32(GRID));
  let y = u32((1.0 - in.uv.y) * f32(GRID));
  let gx = min(x, GRID - 1u);
  let gy = min(y, GRID - 1u);
  let alive = cells[gy * GRID + gx];
  return select(params.deadColor, params.aliveColor, alive == 1u);
}
