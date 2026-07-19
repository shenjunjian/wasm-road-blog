import { Scene, PerspectiveCamera, Color, Vector3, WebGPURenderer } from "three/webgpu";
import { buildScene, updateSceneTransforms } from "./scene.js";
import { createParticleSystem } from "./particles.js";

const CLEAR_COLOR = 0x598cc7; // ~ rgb(0.35, 0.55, 0.78)

function showError(msg) {
  const el = document.getElementById("error");
  el.textContent = msg;
  el.classList.add("visible");
}

async function main() {
  if (!navigator.gpu) {
    showError("当前浏览器不支持 WebGPU。请使用最新版 Chrome 或 Edge。");
    return;
  }

  const app = document.getElementById("app");

  const renderer = new WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(CLEAR_COLOR, 1);
  app.appendChild(renderer.domElement);

  try {
    await renderer.init();
  } catch (err) {
    showError(`WebGPURenderer 初始化失败：${err?.message || err}`);
    return;
  }

  const scene = new Scene();
  scene.background = new Color(CLEAR_COLOR);

  const camera = new PerspectiveCamera(
    45,
    window.innerWidth / Math.max(window.innerHeight, 1),
    0.1,
    100
  );
  camera.position.set(3.2, 2.4, 4.6);
  camera.lookAt(0, 0.9, 0);

  const parts = buildScene(scene);
  const particles = createParticleSystem();
  scene.add(particles.sprite);

  renderer.compute(particles.computeInit);

  const headWorld = new Vector3();
  let lastT = performance.now();

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    const time = now / 1000;

    updateSceneTransforms(parts, time);

    parts.headAnchor.getWorldPosition(headWorld);
    particles.emitter.value.copy(headWorld);
    particles.deltaTime.value = dt;

    renderer.compute(particles.computeUpdate);
    renderer.render(scene, camera);
  });
}

main().catch((err) => {
  console.error(err);
  showError(String(err?.message || err));
});
