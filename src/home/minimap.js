/* ==========================================================================
   minimap.js — the HUD map's subject: the same scanned body, small, flat
   white with one key light. It is a map marker, not a second show: it faces
   the viewer and only sways a little, glancing toward the pointer. It does
   NOT follow the scroll spin of block 01's figure – a marker that whirls when
   the page moves reads as broken.

   Its own tiny renderer rather than a viewport of the big one: the big canvas
   is full screen and composited under the copy, the map sits in the HUD above
   it. The geometry is the cached one, so this costs a context, not a download.
   ========================================================================== */

import * as THREE from 'three';
import { loadGeometry, normaliseMatrix, ASSETS } from '../three/assets.js';
import { damp, clamp, reducedMotion } from '../core/loop.js';

export const MINIMAP_CONFIG = {
  height: 0.58,  // share of the map's height the figure stands
  fov: 28,
  dprCap: 2,
  swayDeg: 14, swayRate: 0.35, // slow idle sway either side of facing front
  lookDeg: 20, lookEase: 3,    // turn toward the pointer's side of the screen
};

export async function createMiniFigure(canvas, overrides = {}) {
  const cfg = { ...MINIMAP_CONFIG, ...overrides };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.01, 20);

  const body = await loadGeometry(ASSETS.body);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(body, mat);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(normaliseMatrix(body));
  const spin = new THREE.Group();
  spin.add(mesh);
  scene.add(spin);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-1.5, 2, 2);
  scene.add(key);

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cfg.dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = THREE.MathUtils.degToRad(cfg.fov / 2);
    camera.position.set(0, 0.5, 1 / (cfg.height * 2 * Math.tan(half)));
    camera.lookAt(0, 0.5, 0);
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  let look = 0;
  let lookTarget = 0;
  const onMove = (e) => (lookTarget = clamp(e.clientX / Math.max(1, innerWidth), 0, 1) * 2 - 1);
  addEventListener('pointermove', onMove);

  return {
    update(dt, t) {
      look = damp(look, lookTarget, cfg.lookEase, dt);
      const sway = reducedMotion ? 0 : Math.sin(t * cfg.swayRate * Math.PI * 2) * cfg.swayDeg;
      spin.rotation.y = THREE.MathUtils.degToRad(sway + look * cfg.lookDeg);
      renderer.render(scene, camera);
    },
    dispose() {
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
      mat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
