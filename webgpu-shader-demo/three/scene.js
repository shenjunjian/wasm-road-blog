import {
  Group,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  TorusGeometry,
  PlaneGeometry,
  DirectionalLight,
  AmbientLight,
} from "three/webgpu";
import {
  createGrassMaterial,
  createCharacterMaterial,
  createWeaponMaterial,
  createAuraMaterial,
} from "./materials.js";

/**
 * Build scene graph matching raw demo proportions:
 * character feet at y=0, head ~1.72, weapon in right hand with aura rings.
 */
export function buildScene(scene) {
  const ambient = new AmbientLight(0xb0c4de, 0.55);
  const sun = new DirectionalLight(0xfff2e0, 1.1);
  sun.position.set(0.35, 1.0, -0.45);
  scene.add(ambient, sun);

  const ground = new Mesh(new PlaneGeometry(28, 28, 1, 1), createGrassMaterial());
  ground.rotation.x = -Math.PI / 2;
  const groundUv = ground.geometry.attributes.uv;
  for (let i = 0; i < groundUv.count; i++) {
    groundUv.setXY(i, groundUv.getX(i) * 28, groundUv.getY(i) * 28);
  }
  groundUv.needsUpdate = true;
  scene.add(ground);

  const characterMat = createCharacterMaterial();
  const character = new Group();
  character.name = "character";

  const addBox = (cx, cy, cz, sx, sy, sz) => {
    const m = new Mesh(new BoxGeometry(sx, sy, sz), characterMat);
    m.position.set(cx, cy, cz);
    character.add(m);
  };

  addBox(0, 1.05, 0, 0.45, 0.7, 0.28);
  const head = new Mesh(new SphereGeometry(0.18, 16, 12), characterMat);
  head.position.set(0, 1.55, 0);
  character.add(head);
  addBox(0, 0.62, 0, 0.4, 0.2, 0.26);
  addBox(-0.12, 0.28, 0, 0.14, 0.55, 0.14);
  addBox(0.12, 0.28, 0, 0.14, 0.55, 0.14);
  addBox(-0.32, 1.05, 0, 0.12, 0.55, 0.12);
  addBox(0.38, 1.0, 0.05, 0.12, 0.5, 0.12);

  const headAnchor = new Group();
  headAnchor.position.set(0, 1.72, 0);
  character.add(headAnchor);

  const hand = new Group();
  hand.position.set(0.48, 0.85, 0.12);
  character.add(hand);

  const weaponMat = createWeaponMaterial();
  const weapon = new Group();
  const wBox = (cx, cy, cz, sx, sy, sz) => {
    const m = new Mesh(new BoxGeometry(sx, sy, sz), weaponMat);
    m.position.set(cx, cy, cz);
    weapon.add(m);
  };
  wBox(0, 0.08, 0, 0.06, 0.2, 0.06);
  wBox(0, 0.2, 0, 0.28, 0.04, 0.08);
  wBox(0, 0.55, 0, 0.08, 0.7, 0.03);
  wBox(0, 0.95, 0, 0.05, 0.12, 0.02);
  hand.add(weapon);

  // TorusGeometry 默认在 XY 平面；转到 XZ，使环绕竖直刀身（+Y）
  const auraGeo = new TorusGeometry(0.42, 0.045, 12, 48);
  const aura1 = new Mesh(auraGeo, createAuraMaterial(0));
  aura1.position.set(0, 0.5, 0);
  aura1.rotation.x = Math.PI / 2;
  weapon.add(aura1);

  const aura2 = new Mesh(auraGeo.clone(), createAuraMaterial(1));
  aura2.position.set(0, 0.72, 0);
  aura2.rotation.x = Math.PI / 2 + 0.35;
  weapon.add(aura2);

  scene.add(character);

  return { character, hand, weapon, aura1, aura2, headAnchor };
}

/** Mirror raw/scene.js weapon swing + aura spin */
export function updateSceneTransforms(parts, t) {
  const { character, hand, aura1, aura2 } = parts;

  character.rotation.y = Math.sin(t * 0.7) * 0.08;

  const swing = Math.sin(t * 1.6) * 0.35;
  const tilt = Math.sin(t * 1.6 + 0.4) * 0.08;
  hand.rotation.set(swing, tilt, -0.35 + swing * 0.15);

  aura1.rotation.y = t * 1.8;
  aura2.rotation.y = -t * 2.4;
}
