import { AdditiveBlending, Sprite, Vector3, SpriteNodeMaterial } from "three/webgpu";
import {
  Fn,
  If,
  instancedArray,
  instanceIndex,
  uniform,
  float,
  vec3,
  hash,
  sin,
  cos,
  clamp,
  mix,
  length,
  uv,
  time,
  smoothstep,
} from "three/tsl";

export const PARTICLE_COUNT = 46;

/**
 * Head-emitter particles updated by TSL compute (same behavior as raw WGSL).
 */
export function createParticleSystem() {
  const positions = instancedArray(PARTICLE_COUNT, "vec3");
  const velocities = instancedArray(PARTICLE_COUNT, "vec3");
  const lives = instancedArray(PARTICLE_COUNT, "float");
  const seeds = instancedArray(PARTICLE_COUNT, "float");

  const emitter = uniform(new Vector3(0, 1.72, 0));
  const deltaTime = uniform(0.016);

  const computeInit = Fn(() => {
    const i = float(instanceIndex);
    const s = i.mul(17.13);
    const rx = hash(s).mul(2).sub(1);
    const rz = hash(s.add(1.7)).mul(2).sub(1);
    const ry = hash(s.add(3.1));
    const seed = hash(s.add(11));

    positions
      .element(instanceIndex)
      .assign(emitter.add(vec3(rx.mul(0.12), ry.mul(0.05), rz.mul(0.12))));
    velocities
      .element(instanceIndex)
      .assign(
        vec3(
          rx.mul(0.15),
          float(0.55).add(hash(s.add(5)).mul(0.55)),
          rz.mul(0.15)
        )
      );
    lives
      .element(instanceIndex)
      .assign(float(0.6).add(hash(s.add(9)).mul(1.4)));
    seeds.element(instanceIndex).assign(seed);
  })()
    .compute(PARTICLE_COUNT)
    .setName("Init Head Particles");

  const computeUpdate = Fn(() => {
    const position = positions.element(instanceIndex);
    const velocity = velocities.element(instanceIndex);
    const life = lives.element(instanceIndex);
    const seed = seeds.element(instanceIndex);
    const dt = deltaTime;
    const t = time;

    life.assign(life.sub(dt));

    If(life.lessThanEqual(0), () => {
      const i = float(instanceIndex);
      const s = i.mul(17.13).add(t.mul(0.1));
      const rx = hash(s).mul(2).sub(1);
      const rz = hash(s.add(1.7)).mul(2).sub(1);
      const ry = hash(s.add(3.1));
      const newSeed = hash(s.add(11));

      position.assign(
        emitter.add(vec3(rx.mul(0.12), ry.mul(0.05), rz.mul(0.12)))
      );
      velocity.assign(
        vec3(
          rx.mul(0.15),
          float(0.55).add(hash(s.add(5)).mul(0.55)),
          rz.mul(0.15)
        )
      );
      life.assign(float(0.6).add(hash(s.add(9)).mul(1.4)));
      seed.assign(newSeed);
    }).Else(() => {
      const swirl = vec3(
        sin(t.mul(1.7).add(seed.mul(6.28))).mul(0.08),
        0,
        cos(t.mul(1.3).add(seed.mul(4))).mul(0.08)
      );
      velocity.addAssign(vec3(0, 0.12, 0).add(swirl).mul(dt));
      velocity.mulAssign(0.99);
      position.addAssign(velocity.mul(dt));
    });
  })()
    .compute(PARTICLE_COUNT)
    .setName("Update Head Particles");

  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  material.positionNode = positions.toAttribute();
  material.scaleNode = Fn(() => {
    const seed = seeds.element(instanceIndex);
    return float(0.04).add(seed.mul(0.03));
  })();
  material.colorNode = Fn(() => {
    const seed = seeds.element(instanceIndex);
    const life = lives.element(instanceIndex);
    const fade = clamp(life.div(0.35), 0, 1).mul(clamp(life, 0, 1));
    const soft = smoothstep(0.5, 0.05, length(uv().sub(0.5)));
    const spark = soft.mul(soft);
    const hue = mix(vec3(0.55, 0.85, 1.0), vec3(1.0, 0.9, 0.55), seed);
    return hue.mul(spark).mul(float(1.2).add(fade));
  })();
  material.opacityNode = Fn(() => {
    const life = lives.element(instanceIndex);
    const fade = clamp(life.div(0.35), 0, 1).mul(clamp(life, 0, 1));
    const soft = smoothstep(0.5, 0.05, length(uv().sub(0.5)));
    return soft.mul(fade).mul(0.85);
  })();

  const sprite = new Sprite(material);
  sprite.count = PARTICLE_COUNT;
  sprite.frustumCulled = false;

  return {
    sprite,
    computeInit,
    computeUpdate,
    emitter,
    deltaTime,
    count: PARTICLE_COUNT,
  };
}
