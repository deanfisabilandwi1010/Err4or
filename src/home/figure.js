/* ==========================================================================
   figure.js — block 01: the scanned figure and its x-ray.

   Body and skeleton share ONE normalising matrix, computed from the body, so
   the skeleton stays where it was fitted. The body owns reveal band [−1, split)
   and the skeleton [split, 9): wherever the pointer has painted the fluid mask,
   skin is discarded and the Fresnel-lit skeleton behind it shows through.

   SCROLL TURNS IT, AND IT DRIFTS ON ITS OWN. The drift is added to the same
   angle the scroll eases, so the hand-over when scrolling stops has no seam.

   THE SILHOUETTE IS READ BACK so the case file can part around it. The body
   is drawn flat white into a tiny target and readPixels gives, per row, where
   the figure starts and ends on screen. readPixels is a full GPU sync, so it is
   gated twice: never more often than silEvery, and only once the figure has
   actually turned silEps degrees (or the camera leaned) since the last read.
   The edges then EASE toward each new read, so the copy glides instead of
   stepping nine times a second.
   ========================================================================== */

import * as THREE from 'three';
import { createFigureStage } from '../three/stage.js';
import { createScanMaterial } from '../three/scanMaterial.js';
import { loadGeometry, normaliseMatrix, ASSETS } from '../three/assets.js';
import { damp, reducedMotion } from '../core/loop.js';

export const FIGURE_CONFIG = {
  height: 0.46, fov: 70, offsetY: 0, lowAngle: 0.05,
  tone: 1, tint: '#66cccc', shade: '#2a2f86', dots: 0.35, iri: 0, scan: 0.25, grain: 0.15,
  idleSpeedDeg: 6, scrollTurnDeg: 540, ease: 8,
  mouseGain: 1, mouseX: 0.06, mouseY: 0.035, mouseEase: 4,
  breath: 0.012, breathRate: 0.19, breathPhase: 0.14,
  split: 0.45, xray: '#4fb3ff', xrayFresnel: 1.2, xrayPow: 2.5, xrayGlow: 0.6, edgeGlow: 0.9,
  brush: 0.1,
  silW: 96, silH: 180, silEvery: 0.11, silEps: 1.2, silEase: 0.07,
  /* FITTING THE SKELETON. The skeleton is a separate generation with its own
     proportions: measured against the body it stops at 0.87 of the height with
     its shoulders at 0.71, where the body's are at 0.81 and its head runs to
     0.99 — so the skull sat in the neck, small. It is stretched to the body
     (about the feet) and the skull alone is widened, blended in over a band at
     the neck so nothing tears. All in body-normalised units (height 1). */
  skelScaleY: 1.12, skelScaleXZ: 1.06,
  skullFrom: 0.84, skullBlend: 0.04, skullScaleXZ: 1.2, skullScaleY: 1.04,
};

/* Bake the normalising matrix into a COPY of the skeleton and reshape it (the
   geometry is cached and shared, so the original is never touched). */
function fitSkeleton(geo, norm, cfg) {
  const g = geo.clone();
  g.applyMatrix4(norm);
  const p = g.attributes.position;
  // centre of the skull band, so widening it does not push it sideways
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) * cfg.skelScaleY;
    if (y > cfg.skullFrom) { cx += p.getX(i); cz += p.getZ(i); n++; }
  }
  cx = n ? (cx / n) * cfg.skelScaleXZ : 0;
  cz = n ? (cz / n) * cfg.skelScaleXZ : 0;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * cfg.skelScaleXZ;
    let y = p.getY(i) * cfg.skelScaleY;
    let z = p.getZ(i) * cfg.skelScaleXZ;
    const k = THREE.MathUtils.smoothstep(y, cfg.skullFrom - cfg.skullBlend, cfg.skullFrom);
    if (k > 0) {
      const sxz = 1 + (cfg.skullScaleXZ - 1) * k;
      const sy = 1 + (cfg.skullScaleY - 1) * k;
      x = cx + (x - cx) * sxz;
      z = cz + (z - cz) * sxz;
      y = cfg.skullFrom + (y - cfg.skullFrom) * sy;
    }
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export async function createFigure(canvas, overrides = {}) {
  const cfg = { ...FIGURE_CONFIG, ...overrides };
  const stage = createFigureStage(canvas, {
    fov: cfg.fov, height: cfg.height, offsetY: cfg.offsetY, lowAngle: cfg.lowAngle,
    fluid: { radius: cfg.brush },
  });

  const [body, skeleton] = await Promise.all([
    loadGeometry(ASSETS.body),
    loadGeometry(ASSETS.skeleton).catch((err) => (console.warn('[figure] no skeleton', err), null)),
  ]);
  const norm = normaliseMatrix(body);
  const spin = new THREE.Group();
  stage.root.add(spin);

  const xray = new THREE.Color(cfg.xray);
  const bodyMat = createScanMaterial(stage.shared, {
    uTone: cfg.tone, uTint: new THREE.Color(cfg.tint), uShade: new THREE.Color(cfg.shade), uDuo: 1, uDots: cfg.dots,
    uIri: cfg.iri, uScan: cfg.scan, uGrain: cfg.grain,
    uBreath: reducedMotion ? 0 : cfg.breath, uBreathRate: cfg.breathRate, uBreathPhase: cfg.breathPhase,
    uLo: -1, uHi: cfg.split, uRevGlow: cfg.edgeGlow, uRevTint: xray,
  }, { side: THREE.DoubleSide });
  const add = (geo, mat, order, matrix = norm) => {
    const m = new THREE.Mesh(geo, mat);
    m.matrixAutoUpdate = false;
    m.matrix.copy(matrix);
    m.renderOrder = order;
    spin.add(m);
    return m;
  };
  add(body, bodyMat, 1);

  let skelMat = null;
  let skelMesh = null;
  if (skeleton) {
    skelMat = createScanMaterial(stage.shared, {
      uTone: 0.12, uTint: xray, uScan: 0.2, uGrain: 0.06,
      uFresnel: cfg.xrayFresnel, uFresnelPow: cfg.xrayPow, uInnerGlow: cfg.xrayGlow,
      uLo: cfg.split, uHi: 9, uRevGlow: cfg.edgeGlow, uRevTint: xray,
    }, { side: THREE.DoubleSide });
    skelMesh = add(fitSkeleton(skeleton, norm, cfg), skelMat, 0, new THREE.Matrix4());
  }

  // ---- silhouette read-back ----
  const silRT = new THREE.WebGLRenderTarget(cfg.silW, cfg.silH);
  const silMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const px = new Uint8Array(cfg.silW * cfg.silH * 4);
  const target = { l: new Float32Array(cfg.silH).fill(NaN), r: new Float32Array(cfg.silH).fill(NaN) };
  const edge = { l: new Float32Array(cfg.silH).fill(NaN), r: new Float32Array(cfg.silH).fill(NaN) };
  let silAcc = Infinity;
  let silAngle = Infinity;
  let silLean = Infinity;
  const readSilhouette = () => {
    const r = stage.renderer;
    const { w: W } = stage.size;
    if (skelMesh) skelMesh.visible = false;
    stage.scene.overrideMaterial = silMat;
    r.setRenderTarget(silRT);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(stage.scene, stage.camera);
    r.readRenderTargetPixels(silRT, 0, 0, cfg.silW, cfg.silH, px);
    r.setRenderTarget(null);
    stage.scene.overrideMaterial = null;
    if (skelMesh) skelMesh.visible = true;
    for (let ry = 0; ry < cfg.silH; ry++) {
      let lo = -1, hi = -1;
      const row = ry * cfg.silW * 4;
      for (let x = 0; x < cfg.silW; x++) {
        if (px[row + x * 4 + 3] > 0) { if (lo < 0) lo = x; hi = x; }
      }
      const sy = cfg.silH - 1 - ry;   // readPixels rows run bottom-up
      target.l[sy] = lo < 0 ? NaN : (lo / cfg.silW) * W;
      target.r[sy] = lo < 0 ? NaN : ((hi + 1) / cfg.silW) * W;
    }
  };
  const easeEdges = (dt) => {
    const k = 1 - Math.exp(-dt / cfg.silEase);
    for (const s of ['l', 'r']) {
      const e = edge[s], tg = target[s];
      for (let i = 0; i < e.length; i++) {
        if (Number.isNaN(tg[i])) e[i] = NaN;
        else e[i] = Number.isNaN(e[i]) ? tg[i] : e[i] + (tg[i] - e[i]) * k;
      }
    }
  };
  const onResize = () => (silAcc = Infinity);
  addEventListener('resize', onResize);

  let idle = 0;
  let turn = 0;
  const lean = { x: 0, y: 0 };

  return {
    stage, cfg,
    materials: { body: bodyMat, skeleton: skelMat },
    /* scroll01: 0..1 progress through the copy */
    update(dt, t, { scroll01 = 0, paint = true } = {}) {
      idle += (reducedMotion ? cfg.idleSpeedDeg * 0.3 : cfg.idleSpeedDeg) * dt;
      turn = damp(turn, scroll01 * cfg.scrollTurnDeg, cfg.ease, dt);
      spin.rotation.y = THREE.MathUtils.degToRad(idle + turn);
      lean.x = damp(lean.x, stage.pointer.x * cfg.mouseX * cfg.mouseGain, cfg.mouseEase, dt);
      lean.y = damp(lean.y, stage.pointer.y * cfg.mouseY * cfg.mouseGain, cfg.mouseEase, dt);
      stage.frame(lean);
      silAcc += dt;
      const angle = idle + turn;
      const leanMove = Math.abs(lean.x - silLean) * 1000;
      if (silAcc >= cfg.silEvery && (Math.abs(angle - silAngle) >= cfg.silEps || leanMove > 1)) {
        readSilhouette();
        silAcc = 0; silAngle = angle; silLean = lean.x;
      }
      easeEdges(dt);
      stage.render(dt, t, { paint });
    },
    /* Where the figure is, in CSS px, for the screen band y0..y1:
       [left, right] of the silhouette, or null if no part of it is in that band. */
    edgeAt(y0, y1) {
      const H = stage.size.h;
      const a = Math.max(0, Math.floor((y0 / H) * cfg.silH) - 1);
      const b = Math.min(cfg.silH - 1, Math.ceil((y1 / H) * cfg.silH) + 1);
      let l = Infinity, r = -Infinity;
      for (let i = a; i <= b; i++) {
        if (Number.isNaN(edge.l[i])) continue;
        if (edge.l[i] < l) l = edge.l[i];
        if (edge.r[i] > r) r = edge.r[i];
      }
      return l === Infinity ? null : [l, r];
    },
    dispose: () => { removeEventListener('resize', onResize); skelMesh?.geometry.dispose(); silRT.dispose(); silMat.dispose(); stage.dispose(); },
  };
}
