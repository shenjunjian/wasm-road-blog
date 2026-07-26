import {
  mat4Multiply,
  mat4Translate,
  mat4RotateX,
  mat4RotateY,
  mat4RotateZ,
} from "./math.js";

/**
 * Build per-frame model matrices for character, weapon, aura.
 * Weapon gently swings; aura follows weapon mid-blade.
 */
export function updateSceneTransforms(time) {
  const characterRoot = mat4Translate(0, 0, 0);
  // idle sway
  const sway = mat4RotateY(Math.sin(time * 0.7) * 0.08);
  const characterModel = mat4Multiply(characterRoot, sway);

  const handLocal = mat4Translate(0.48, 0.85, 0.12);
  const swing = Math.sin(time * 1.6) * 0.35;
  const tilt = Math.sin(time * 1.6 + 0.4) * 0.08;
  const weaponLocal = mat4Multiply(
    mat4Multiply(handLocal, mat4RotateZ(-0.35 + swing * 0.15)),
    mat4Multiply(mat4RotateX(swing), mat4RotateY(tilt))
  );
  const weaponModel = mat4Multiply(characterModel, weaponLocal);

  // Two horizontal rings around the blade (torus in XZ, blade along +Y)
  const auraModel = mat4Multiply(
    weaponModel,
    mat4Multiply(mat4Translate(0, 0.5, 0), mat4RotateY(time * 1.8))
  );
  const auraModel2 = mat4Multiply(
    weaponModel,
    mat4Multiply(
      mat4Translate(0, 0.72, 0),
      mat4Multiply(mat4RotateY(-time * 2.4), mat4RotateX(0.35))
    )
  );

  const headLocal = [0, 1.72, 0, 1];
  const headWorld = transformPoint(characterModel, headLocal);

  return {
    characterModel,
    weaponModel,
    auraModel,
    auraModel2,
    headWorld,
  };
}

function transformPoint(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12] * p[3];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13] * p[3];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14] * p[3];
  return [x, y, z];
}
