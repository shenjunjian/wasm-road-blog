/** Interleaved: position(3) + normal(3) + uv(2) = 8 floats */

function pushBox(positions, normals, uvs, indices, cx, cy, cz, sx, sy, sz, base) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces = [
    // +Z
    [
      [cx - hx, cy - hy, cz + hz],
      [cx + hx, cy - hy, cz + hz],
      [cx + hx, cy + hy, cz + hz],
      [cx - hx, cy + hy, cz + hz],
      [0, 0, 1],
    ],
    // -Z
    [
      [cx + hx, cy - hy, cz - hz],
      [cx - hx, cy - hy, cz - hz],
      [cx - hx, cy + hy, cz - hz],
      [cx + hx, cy + hy, cz - hz],
      [0, 0, -1],
    ],
    // +X
    [
      [cx + hx, cy - hy, cz + hz],
      [cx + hx, cy - hy, cz - hz],
      [cx + hx, cy + hy, cz - hz],
      [cx + hx, cy + hy, cz + hz],
      [1, 0, 0],
    ],
    // -X
    [
      [cx - hx, cy - hy, cz - hz],
      [cx - hx, cy - hy, cz + hz],
      [cx - hx, cy + hy, cz + hz],
      [cx - hx, cy + hy, cz - hz],
      [-1, 0, 0],
    ],
    // +Y
    [
      [cx - hx, cy + hy, cz + hz],
      [cx + hx, cy + hy, cz + hz],
      [cx + hx, cy + hy, cz - hz],
      [cx - hx, cy + hy, cz - hz],
      [0, 1, 0],
    ],
    // -Y
    [
      [cx - hx, cy - hy, cz - hz],
      [cx + hx, cy - hy, cz - hz],
      [cx + hx, cy - hy, cz + hz],
      [cx - hx, cy - hy, cz + hz],
      [0, -1, 0],
    ],
  ];

  const uvCorner = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];

  for (const face of faces) {
    const n = face[4];
    const start = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      const p = face[i];
      positions.push(p[0], p[1], p[2]);
      normals.push(n[0], n[1], n[2]);
      uvs.push(uvCorner[i][0], uvCorner[i][1]);
    }
    indices.push(
      base + start,
      base + start + 1,
      base + start + 2,
      base + start,
      base + start + 2,
      base + start + 3
    );
  }
  return base;
}

function pushSphere(positions, normals, uvs, indices, cx, cy, cz, r, seg, base) {
  const rings = seg;
  const sectors = seg * 2;
  const start = positions.length / 3;

  for (let i = 0; i <= rings; i++) {
    const v = i / rings;
    const phi = v * Math.PI;
    const y = Math.cos(phi);
    const ringR = Math.sin(phi);
    for (let j = 0; j <= sectors; j++) {
      const u = j / sectors;
      const theta = u * Math.PI * 2;
      const x = Math.cos(theta) * ringR;
      const z = Math.sin(theta) * ringR;
      positions.push(cx + x * r, cy + y * r, cz + z * r);
      normals.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sectors; j++) {
      const a = start + i * (sectors + 1) + j;
      const b = a + sectors + 1;
      indices.push(base + a, base + b, base + a + 1);
      indices.push(base + b, base + b + 1, base + a + 1);
    }
  }
  return base;
}

function interleave(positions, normals, uvs) {
  const count = positions.length / 3;
  const data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++) {
    const o = i * 8;
    data[o] = positions[i * 3];
    data[o + 1] = positions[i * 3 + 1];
    data[o + 2] = positions[i * 3 + 2];
    data[o + 3] = normals[i * 3];
    data[o + 4] = normals[i * 3 + 1];
    data[o + 5] = normals[i * 3 + 2];
    data[o + 6] = uvs[i * 2];
    data[o + 7] = uvs[i * 2 + 1];
  }
  return data;
}

export function createGround(size = 24) {
  const h = size / 2;
  // 四角坐标表
  const positions = [
    -h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h,
  ];
  // 法线
  const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  // 纹理坐标
  const uvs = [0, 0, size, 0, size, size, 0, size];
  // 索引
  const indices = [0, 1, 2, 0, 2, 3];
  return {
    // 将位置、法线、纹理坐标合并成一个 Float32Array，每一个点占用 8 个字节： 3+3+2
    vertices: interleave(positions, normals, uvs), 
    indices: new Uint16Array(indices),
    kind: "ground",
  };
}

/** Character in local space: feet at y=0, head near y=1.7 */
export function createCharacter() {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let base = 0;

  // torso
  pushBox(positions, normals, uvs, indices, 0, 1.05, 0, 0.45, 0.7, 0.28, base);
  // head
  pushSphere(positions, normals, uvs, indices, 0, 1.55, 0, 0.18, 12, base);
  // hips
  pushBox(positions, normals, uvs, indices, 0, 0.62, 0, 0.4, 0.2, 0.26, base);
  // legs
  pushBox(positions, normals, uvs, indices, -0.12, 0.28, 0, 0.14, 0.55, 0.14, base);
  pushBox(positions, normals, uvs, indices, 0.12, 0.28, 0, 0.14, 0.55, 0.14, base);
  // arms (right arm holds weapon — slightly out)
  pushBox(positions, normals, uvs, indices, -0.32, 1.05, 0, 0.12, 0.55, 0.12, base);
  pushBox(positions, normals, uvs, indices, 0.38, 1.0, 0.05, 0.12, 0.5, 0.12, base);

  return {
    vertices: interleave(positions, normals, uvs),
    indices: new Uint16Array(indices),
    kind: "character",
    headPosition: [0, 1.72, 0],
    handPosition: [0.48, 0.85, 0.12],
  };
}

/** Weapon blade along +Y in local space, grip at origin */
export function createWeapon() {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const base = 0;
  // grip
  pushBox(positions, normals, uvs, indices, 0, 0.08, 0, 0.06, 0.2, 0.06, base);
  // guard
  pushBox(positions, normals, uvs, indices, 0, 0.2, 0, 0.28, 0.04, 0.08, base);
  // blade
  pushBox(positions, normals, uvs, indices, 0, 0.55, 0, 0.08, 0.7, 0.03, base);
  // tip-ish
  pushBox(positions, normals, uvs, indices, 0, 0.95, 0, 0.05, 0.12, 0.02, base);

  return {
    vertices: interleave(positions, normals, uvs),
    indices: new Uint16Array(indices),
    kind: "weapon",
  };
}

/** Torus ring in XZ plane, centered at origin */
export function createAuraRing(majorR = 0.42, minorR = 0.045, segments = 48, tube = 12) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const theta = u * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    for (let j = 0; j <= tube; j++) {
      const v = j / tube;
      const phi = v * Math.PI * 2;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      const x = (majorR + minorR * cosP) * cosT;
      const y = minorR * sinP;
      const z = (majorR + minorR * cosP) * sinT;
      positions.push(x, y, z);
      const nx = cosP * cosT;
      const ny = sinP;
      const nz = cosP * sinT;
      normals.push(nx, ny, nz);
      uvs.push(u * 3, v);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < tube; j++) {
      const a = i * (tube + 1) + j;
      const b = a + tube + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    vertices: interleave(positions, normals, uvs),
    indices: new Uint16Array(indices),
    kind: "aura",
  };
}

export const VERTEX_STRIDE = 8 * 4;
export const VERTEX_LAYOUT = {
  arrayStride: VERTEX_STRIDE,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
  ],
};
