/* ==========================================================================
   stage.js — createFigureStage(canvas, config): one renderer, one camera,
   one fluid mask, and the shared uniforms its layers read.

   A FACTORY, not a singleton: block 01's figure and block 02's head are two
   instances with different dials, and nothing one of them sets can reach the
   other.
   ========================================================================== */

import * as THREE from 'three';
import { Fluid } from './fluid.js';

export function createFigureStage(canvas, config) {
  const cfg = { fov: 70, height: 0.46, offsetX: 0, offsetY: 0, dprCap: 1.5, ...config };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.01, 50);
  const root = new THREE.Group();   // normalised space: the subject is 1 unit tall, feet at 0
  scene.add(root);

  const fluid = new Fluid(renderer, cfg.fluid);
  const shared = {
    uTime: { value: 0 },
    uReveal: { value: fluid.texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uDpr: { value: 1 },
  };

  const pointer = { x: 0, y: 0, u: -1, v: -1, inside: false };
  const size = { w: 1, h: 1 };

  function resize() {
    // a pane being dragged can pass through 0 px; never size anything to zero
    const w = Math.max(1, canvas.clientWidth || innerWidth);
    const h = Math.max(1, canvas.clientHeight || innerHeight);
    const dpr = Math.min(devicePixelRatio || 1, cfg.dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    size.w = w; size.h = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    shared.uResolution.value.set(w * dpr, h * dpr);
    shared.uDpr.value = dpr;
  }

  /* Frame the 1-unit subject so it is `height` of the viewport tall, then let
     offsets slide it (in viewport heights) and a lean move the EYE sideways. */
  function frame(lean = { x: 0, y: 0 }) {
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const dist = 1 / (cfg.height * 2 * Math.tan(half));
    const visH = 2 * dist * Math.tan(half);
    const ty = 0.5 - cfg.offsetY * visH;
    const tx = -cfg.offsetX * visH;
    camera.position.set(tx + lean.x * visH, ty + lean.y * visH - (cfg.lowAngle || 0) * visH, dist);
    camera.lookAt(tx, ty, 0);
  }

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    pointer.u = (e.clientX - r.left) / r.width;
    pointer.v = 1 - (e.clientY - r.top) / r.height;
    fluid.setPointer(pointer.u, pointer.v);
  };
  addEventListener('pointermove', onMove);
  addEventListener('resize', resize);
  resize();
  frame();

  return {
    renderer, scene, camera, root, fluid, shared, pointer, size, cfg,
    resize, frame,
    render(dt, t, { paint = true } = {}) {
      shared.uTime.value = t;
      fluid.enabled = paint;
      fluid.update(dt, t, size.w / size.h);
      shared.uReveal.value = fluid.texture;
      renderer.render(scene, camera);
    },
    dispose() {
      removeEventListener('pointermove', onMove);
      removeEventListener('resize', resize);
      scene.traverse((o) => { if (o.material) o.material.dispose(); });
      fluid.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
