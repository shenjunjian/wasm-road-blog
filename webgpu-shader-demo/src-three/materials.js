import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import {
  Fn,
  float,
  vec3,
  uv,
  positionWorld,
  normalWorld,
  time,
  sin,
  fract,
  floor,
  mix,
  smoothstep,
  pow,
  abs,
  max,
  clamp,
  normalize,
  dot,
} from "three/tsl";

/** Procedural grass matching opaque.wgsl kind=0 */
export function createGrassMaterial() {
  const material = new MeshBasicNodeMaterial();
  material.colorNode = Fn(() => {
    const cell = floor(uv().mul(18));
    const hx = fract(
      sin(cell.x.mul(127.1).add(cell.y.mul(311.7))).mul(43758.5453)
    );
    const blade = mix(float(0.75), float(1.15), hx);
    const stripe = float(0.85).add(
      sin(positionWorld.x.mul(7).add(positionWorld.z.mul(5))).mul(0.15)
    );
    let base = vec3(0.22, 0.48, 0.18).mul(blade).mul(stripe);
    base = mix(base, vec3(0.35, 0.55, 0.2), smoothstep(0.6, 1.0, hx).mul(0.35));
    return base;
  })();
  return material;
}

/** Character: skin / cloth / pants by world Y */
export function createCharacterMaterial() {
  const material = new MeshStandardNodeMaterial();
  material.roughness = 0.85;
  material.metalness = 0.05;
  material.colorNode = Fn(() => {
    const y = positionWorld.y;
    const head = vec3(0.86, 0.7, 0.58);
    const torso = vec3(0.25, 0.38, 0.62);
    const legs = vec3(0.2, 0.22, 0.28);
    return y
      .greaterThan(1.4)
      .select(head, y.greaterThan(0.75).select(torso, legs));
  })();
  return material;
}

/** Weapon metal with simple specular pulse */
export function createWeaponMaterial() {
  const material = new MeshStandardNodeMaterial();
  material.roughness = 0.25;
  material.metalness = 0.85;
  material.colorNode = Fn(() => {
    const n = normalize(normalWorld);
    const l = normalize(vec3(0.35, 1.0, -0.45));
    const viewApprox = normalize(vec3(0.4, 0.8, 0.5));
    const halfV = normalize(l.add(viewApprox));
    const ndotl = max(dot(n, l), 0);
    const ambient = float(0.28);
    const diff = ambient.add(ndotl.mul(0.72));
    const spec = pow(max(dot(n, halfV), 0), 48);
    let base = vec3(0.55, 0.58, 0.65)
      .mul(diff)
      .add(vec3(0.7, 0.85, 1.0).mul(spec));
    const edge = pow(
      float(1).sub(max(dot(n, normalize(vec3(0.2, 0.9, 0.3))), 0)),
      2
    );
    base = base.add(
      vec3(0.1, 0.25, 0.45)
        .mul(edge)
        .mul(float(0.5).add(sin(time.mul(3)).mul(0.5)))
    );
    return base;
  })();
  return material;
}

/** Flowing translucent aura ring */
export function createAuraMaterial(timeOffset = 0) {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;

  material.colorNode = Fn(() => {
    const t = time.add(timeOffset);
    const flowU = fract(uv().x.sub(t.mul(0.55)));
    const band = smoothstep(0, 0.15, flowU).mul(smoothstep(1, 0.7, flowU));
    const noise = sin(uv().x.mul(40).add(t.mul(5))).mul(
      sin(uv().y.mul(18).sub(t.mul(3)))
    );
    const n = float(0.55).add(noise.mul(0.45));
    const rim = pow(float(1).sub(abs(uv().y.sub(0.5).mul(2))), 1.6);
    const intensity = band.mul(n).mul(rim);
    return vec3(0.2, 0.65, 1.0)
      .mul(intensity)
      .mul(1.8)
      .add(vec3(0.55, 0.9, 1.0).mul(intensity).mul(intensity));
  })();

  material.opacityNode = Fn(() => {
    const t = time.add(timeOffset);
    const flowU = fract(uv().x.sub(t.mul(0.55)));
    const band = smoothstep(0, 0.15, flowU).mul(smoothstep(1, 0.7, flowU));
    const noise = sin(uv().x.mul(40).add(t.mul(5))).mul(
      sin(uv().y.mul(18).sub(t.mul(3)))
    );
    const n = float(0.55).add(noise.mul(0.45));
    const rim = pow(float(1).sub(abs(uv().y.sub(0.5).mul(2))), 1.6);
    const intensity = band.mul(n).mul(rim);
    return clamp(intensity.mul(0.85), 0, 0.9);
  })();

  return material;
}
