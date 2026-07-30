const GRID: u32 = 128u;

@group(0) @binding(0) var<storage, read> cellsIn: array<u32>;
@group(0) @binding(1) var<storage, read_write> cellsOut: array<u32>;

fn idx(x: u32, y: u32) -> u32 {
  return y * GRID + x;
}

fn aliveAt(x: i32, y: i32) -> u32 {
  if (x < 0 || y < 0 || x >= i32(GRID) || y >= i32(GRID)) {
    return 0u;
  }
  return cellsIn[idx(u32(x), u32(y))];
}

fn neighborCount(x: u32, y: u32) -> u32 {
  let ix = i32(x);
  let iy = i32(y);
  var n = 0u;
  n += aliveAt(ix - 1, iy - 1);
  n += aliveAt(ix,     iy - 1);
  n += aliveAt(ix + 1, iy - 1);
  n += aliveAt(ix - 1, iy);
  n += aliveAt(ix + 1, iy);
  n += aliveAt(ix - 1, iy + 1);
  n += aliveAt(ix,     iy + 1);
  n += aliveAt(ix + 1, iy + 1);
  return n;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= GRID || y >= GRID) {
    return;
  }
  let i = idx(x, y);
  let alive = cellsIn[i];
  let n = neighborCount(x, y);
  if (alive == 1u) {
    cellsOut[i] = select(0u, 1u, n == 2u || n == 3u);
  } else {
    cellsOut[i] = select(0u, 1u, n == 3u);
  }
}
