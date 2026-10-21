/* ==========================================================================
   head.js — block 02: the head. Face plus mask, on the white room's paper,
   turning toward the pointer.

   THREE LAYERS, ONE MASK. The fluid value rv decides which shell is drawn:
       mask   [−1, maskHi)     white silhouette (tone .05 + flatten 1)
       face   [maskHi, faceHi) the bust, lit, with a red fringe at the opening
       skull  [faceHi, 9)      glowing from within
   so lingering over one spot goes mask → face → skull, and it heals back.

   THE POINTER IS SHARED with the page scroll, so it is handed over:
       click          spin two whole turns and land EXACTLY where it started
       drag           move the head (clamped)
       shift / right  turn it
       shift + wheel  scale it
       Home           reset
   ========================================================================== */

import * as THREE from 'three';
import { createFigureStage } from '../three/stage.js';
import { createScanMaterial } from '../three/scanMaterial.js';
import { loadGeometry, normaliseMatrix, ASSETS } from '../three/assets.js';
import { damp, clamp } from '../core/loop.js';

export const HEAD_CONFIG = {
  height: 0.85, offsetY: -0.12, fov: 35,
  tone: 0.05, flatten: 1, flatLevel: 1, grain: 0.04,
  followYaw: 25, followPitch: 12, followEase: 5,
  maskHi: 0.35, faceHi: 0.75, edge: '#ff0000', edgeGlow: 1.2,
  outline: '#bdbdbd', outlineWidth: 0.004,
  spinTurns: 2, spinDur: 1.6, spinShrink: 0.08,
  brush: 0.075,
  /* FITTING THE SKULL. The skull is a separate generation that stands upright
     and faces straight ahead; the bust looks down at the phone with its face
     turned 16° to its right (nose at x≈0, the skull's midline was at 0.087).
     So the skull is turned and tipped to match, about its own centre, then
     nudged (bust-normalised units, height 1). Checked against cut-away
     sections of the bust from the front, both sides and three-quarters. */
  skullYaw: -16, skullPitch: 7, skullOffset: [-0.025, -0.025, 0.02],
};

/* norm, then the skull's own turn / tip / nudge about its centre */
function skullMatrix(geo, norm, cfg) {
  const g = geo.clone().applyMatrix4(norm);
  g.computeBoundingBox();
  const c = g.boundingBox.getCenter(new THREE.Vector3());
  g.dispose();
  const [ox, oy, oz] = cfg.skullOffset;
  const rot = new THREE.Euler(THREE.MathUtils.degToRad(cfg.skullPitch), THREE.MathUtils.degToRad(cfg.skullYaw), 0, 'YXZ');
  return new THREE.Matrix4().makeTranslation(c.x + ox, c.y + oy, c.z + oz)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(rot))
    .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z))
    .multiply(norm);
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function createHead(canvas, overrides = {}) {
  const cfg = { ...HEAD_CONFIG, ...overrides };
  const stage = createFigureStage(canvas, { fov: cfg.fov, height: cfg.height, offsetY: cfg.offsetY, fluid: { radius: cfg.brush, decay: 0.975 } });

  const [bust, mask, skull] = await Promise.all([loadGeometry(ASSETS.bust), loadGeometry(ASSETS.mask), loadGeometry(ASSETS.skull)]);
  const norm = normaliseMatrix(bust);
  const PIVOT_Y = 0.62; // roughly the middle of the head, so pitch nods instead of swinging
  const holder = new THREE.Group();   // position (drag) + scale
  const pivot = new THREE.Group();    // rotation
  pivot.position.y = PIVOT_Y;
  holder.add(pivot);
  stage.root.add(holder);
  const inner = new THREE.Group();
  inner.position.y = -PIVOT_Y;
  pivot.add(inner);

  const edge = new THREE.Color(cfg.edge);
  const mats = {
    outline: createScanMaterial(stage.shared, { uSolid: new THREE.Vector4(...new THREE.Color(cfg.outline).toArray(), 1), uExtrude: cfg.outlineWidth, uLo: -1, uHi: cfg.maskHi }, { side: THREE.BackSide }),
    mask: createScanMaterial(stage.shared, { uTone: cfg.tone, uFlatten: cfg.flatten, uFlatLevel: cfg.flatLevel, uGrain: cfg.grain, uLo: -1, uHi: cfg.maskHi, uRevGlow: cfg.edgeGlow, uRevTint: edge }),
    face: createScanMaterial(stage.shared, { uTone: 0.9, uFlatten: 0.4, uFlatLevel: 0.92, uGrain: 0.05, uLo: cfg.maskHi, uHi: cfg.faceHi, uRevGlow: cfg.edgeGlow, uRevTint: edge }, { side: THREE.DoubleSide }),
    skull: createScanMaterial(stage.shared, { uTone: 0.6, uFresnel: 1, uFresnelPow: 2, uInnerGlow: 0.8, uGrain: 0.05, uLo: cfg.faceHi, uHi: 9, uRevGlow: cfg.edgeGlow, uRevTint: edge }, { side: THREE.DoubleSide }),
  };
  const add = (geo, mat, order, matrix = norm) => {
    const m = new THREE.Mesh(geo, mat);
    m.matrixAutoUpdate = false;
    m.matrix.copy(matrix);
    m.renderOrder = order;
    inner.add(m);
  };
  add(skull, mats.skull, 0, skullMatrix(skull, norm, cfg));
  add(bust, mats.face, 1);
  add(mask, mats.mask, 2);
  add(mask, mats.outline, 3);

  // ---- interaction state ----
  const s = { yaw: 0, pitch: 0, userYaw: 0, userPitch: 0, x: 0, y: 0, tx: 0, ty: 0, scale: 1, tscale: 1, spin: 0, spinT: 1, spinApplied: 0 };
  let active = false;
  let drag = null;

  const visH = () => 2 * stage.camera.position.z * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2));

  const down = (e) => {
    if (!active || e.target.closest('a, button, .bar')) return;
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, turn: e.button === 2 || e.shiftKey, moved: 0 };
  };
  const move = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.turn) {
      s.userYaw += dx * 0.4;
      s.userPitch = clamp(s.userPitch + dy * 0.3, -40, 40);
    } else {
      const k = visH() / innerHeight;
      const lim = visH() * 0.2 * (innerWidth / innerHeight);
      s.tx = clamp(s.tx + dx * k, -lim, lim);
      s.ty = clamp(s.ty - dy * k, -visH() * 0.2, visH() * 0.2);
    }
  };
  const up = () => {
    if (drag && drag.moved < 6 && !drag.turn && s.spinT >= 1) { s.spinT = 0; s.spinApplied = 0; }
    drag = null;
  };
  const key = (e) => {
    if (active && e.key === 'Home') Object.assign(s, { userYaw: 0, userPitch: 0, tx: 0, ty: 0, tscale: 1 });
  };
  const menu = (e) => active && e.preventDefault();
  addEventListener('pointerdown', down);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('keydown', key);
  addEventListener('contextmenu', menu);

  return {
    stage, cfg, materials: mats,
    get active() { return active; },
    setActive(v) { active = v; if (!v) drag = null; },
    /* returns true when it consumed the wheel */
    wheel(d, e) {
      if (!active || !e.shiftKey) return false;
      s.tscale = clamp(s.tscale * Math.exp(-d * 0.0012), 0.3, 6);  // generous, not unbounded
      return true;
    },
    update(dt, t, { paint = true } = {}) {
      const p = stage.pointer;
      s.yaw = damp(s.yaw, active ? p.x * cfg.followYaw : 0, cfg.followEase, dt);
      s.pitch = damp(s.pitch, active ? -p.y * cfg.followPitch : 0, cfg.followEase, dt);

      // CLICK SPIN: a per-frame DELTA of an eased total, so the sum is exactly turns*360
      let shrink = 0;
      if (s.spinT < 1) {
        s.spinT = Math.min(1, s.spinT + dt / cfg.spinDur);
        const total = easeInOut(s.spinT) * cfg.spinTurns * 360;
        s.spin += total - s.spinApplied;
        s.spinApplied = total;
        shrink = cfg.spinShrink * Math.sin(Math.PI * s.spinT);
        if (s.spinT >= 1) s.spin -= cfg.spinTurns * 360;   // lands on exactly where it started
      }

      s.x = damp(s.x, s.tx, 8, dt);
      s.y = damp(s.y, s.ty, 8, dt);
      s.scale = damp(s.scale, s.tscale, 8, dt);
      holder.position.set(s.x, s.y, 0);
      holder.scale.setScalar(s.scale * (1 - shrink));
      pivot.rotation.set(
        THREE.MathUtils.degToRad(s.pitch + s.userPitch),
        THREE.MathUtils.degToRad(s.yaw + s.userYaw + s.spin),
        0
      );
      stage.frame();
      stage.render(dt, t, { paint: paint && active });
    },
    dispose() {
      removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('keydown', key);
      removeEventListener('contextmenu', menu);
      stage.dispose();
    },
  };
}
