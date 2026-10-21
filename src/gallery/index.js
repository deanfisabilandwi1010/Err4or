/* ==========================================================================
   gallery/index.js — a scroll-driven corridor of photographs, in CSS 3D.

   LAYOUT 1, THE PATH: a closed Catmull-Rom curve is both the camera's track
   and the photographs' spine. The camera rides it on scroll and looks a little
   further along it, so bends steer the view. Photos sit at their own points,
   pushed off sideways, turned to the curve's local frame – which is why they
   bank through a corner instead of sliding across it – and SWELL as the camera
   nears them on a cubic falloff, so exactly one is ever the subject.

   NO ENGINE IN THE PAGE: the camera is a view matrix written into matrix3d on
   one wrapper element. three.js is only borrowed for its maths (curve, lookAt,
   inverse), never for rendering.

   CSS axes throughout: x right, y DOWN, z toward the viewer. That is why the
   lookAt "up" below is (0, 1, 0): in a y-down space it is the vector that keeps
   x pointing right.

   Layouts 2–4 (keys): infinite TUNNEL, horizontal WHEEL, FIBONACCI SPHERE.
   ========================================================================== */

import * as THREE from 'three';
import { PROJECTS, GALLERY_COUNT } from '../content.js';
import { onFrame, damp, clamp } from '../core/loop.js';
import { disposer } from '../core/lifecycle.js';
import { createTravel } from '../core/travel.js';
import { poster } from '../core/posters.js';

export const GALLERY_CONFIG = {
  perspective: 900,
  cardW: 280, cardH: 360,
  lap: 9000,          // scroll px for one lap of the path
  lookAhead: 0.018,
  swell: 1.4, swellRange: 900,
  tunnelSpacing: 520, wheelRadius: 900, sphereRadius: 700,
};

const LAYOUTS = ['PATH', 'TUNNEL', 'WHEEL', 'SPHERE'];
const UP = new THREE.Vector3(0, 1, 0);

export function mount(root) {
  const cfg = GALLERY_CONFIG;
  const d = disposer();
  const gal = root.querySelector('[data-gal]');
  const world = root.querySelector('[data-world]');
  const layoutEl = root.querySelector('[data-gal-layout]');
  const indexEl = root.querySelector('[data-gal-index]');
  const map = root.querySelector('[data-map]');
  gal.style.perspective = `${cfg.perspective}px`;

  // red tint filter (luminance → red), defined once for the page
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'fx');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.innerHTML = `<filter id="redtint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="
    .55 .9 .25 0 .02
    0 .08 0 0 0
    0 .08 0 0 0
    0 0 0 1 0"/></filter>`;
  root.appendChild(svg);

  // ---- cards ----
  const N = GALLERY_COUNT;
  const cards = Array.from({ length: N }, (_, i) => {
    const p = PROJECTS[i % PROJECTS.length];
    const el = document.createElement('figure');
    el.className = 'gcard';
    el.innerHTML = `<img alt="" draggable="false" src="${poster(p, i % PROJECTS.length)}" /><figcaption>${String(i + 1).padStart(3, '0')} // ${p.title}</figcaption>`;
    world.appendChild(el);
    return { el, i };
  });

  // ---- the path ----
  const rnd = (i) => ((Math.sin(i * 91.7) * 43758.5453) % 1 + 1) % 1;
  const ctrl = [
    [0, 0, 0], [1400, -200, -1600], [2600, 300, -400], [3400, -100, -2600],
    [2400, 200, -4600], [600, -300, -5200], [-1200, 100, -3600], [-1400, -150, -1200],
  ].map((v) => new THREE.Vector3(...v));
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'catmullrom', 0.5);
  const pathCard = cards.map(({ i }) => {
    const u = (i + 0.5) / N;
    const pos = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    const off = (i % 2 ? 1 : -1) * (230 + rnd(i) * 220);
    pos.addScaledVector(side, off);
    pos.y += (rnd(i + 7) - 0.5) * 360;
    const m = new THREE.Matrix4().lookAt(pos, pos.clone().add(tan), UP); // card front faces back along the track
    m.setPosition(pos);
    return { u, pos, m };
  });

  // mini map: the curve seen from above (x, z)
  const pts = curve.getSpacedPoints(80);
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const mx = (x) => 8 + ((x - x0) / (x1 - x0)) * 144;
  const mz = (z) => 8 + ((z - z0) / (z1 - z0)) * 84;
  map.innerHTML = `<path d="M${pts.map((p) => `${mx(p.x).toFixed(1)} ${mz(p.z).toFixed(1)}`).join('L')}Z" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1"/>${pathCard.map((c) => `<rect x="${mx(c.pos.x) - 1}" y="${mz(c.pos.z) - 1}" width="2" height="2" fill="#000"/>`).join('')}<circle data-cam r="3" fill="#fff" stroke="#000"/>`;
  const camDot = map.querySelector('[data-cam]');

  // ---- input ----
  const travel = createTravel({ max: 1e9, drag: true, ease: 6 });
  travel.target = travel.current = 5e8; // effectively endless both ways
  d(() => travel.destroy());
  let layout = 0;
  let fade = 1;
  d.on(window, 'keydown', (e) => {
    const k = Number(e.key);
    if (k >= 1 && k <= 4 && k - 1 !== layout) {
      layout = k - 1;
      fade = 0;
      for (const c of cards) { c.el.style.visibility = 'visible'; c.el.style.opacity = ''; } // only the path culls
      layoutEl.textContent = `LAYOUT ${k} // ${LAYOUTS[layout]}`;
    }
  });

  const mtx = (m) => `matrix3d(${m.elements.map((v) => v.toFixed(5)).join(',')})`;
  const view = new THREE.Matrix4();
  const cam = new THREE.Matrix4();
  const eye = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const mod = (a, n) => ((a % n) + n) % n;

  d(
    onFrame((dt) => {
      const s = travel.current - 5e8;
      // the fade goes on the CARDS: opacity < 1 on the preserve-3d world would flatten the whole scene
      fade = damp(fade, 1, 6, dt);
      const fadeStr = String(Math.min(1, fade + 0.001));
      let nearest = 0, best = Infinity;

      if (layout === 0) {
        const u = mod(s / cfg.lap, 1);
        curve.getPointAt(u, eye);
        curve.getPointAt(mod(u + cfg.lookAhead, 1), ahead);
        cam.lookAt(eye, ahead, UP).setPosition(eye);
        view.copy(cam).invert().premultiply(new THREE.Matrix4().makeTranslation(0, 0, cfg.perspective));
        world.style.transform = mtx(view);
        for (const c of cards) {
          const pc = pathCard[c.i];
          const dist = tmp.copy(pc.pos).distanceTo(eye);
          if (dist < best) { best = dist; nearest = c.i; }
          const k = Math.pow(1 - clamp(dist / cfg.swellRange), 3);
          c.el.style.transform = `${mtx(pc.m)} scale(${1 + cfg.swell * k})`;
          // CSS has no near plane: a card brushing past the eye would be drawn huge (or mirrored once
          // behind it), so it fades out as it gets close and is hidden once it has passed
          const zView = tmp.copy(pc.pos).applyMatrix4(view).z;
          c.el.style.opacity = String(fade * (1 - clamp((zView - cfg.perspective * 0.45) / (cfg.perspective * 0.3))));
          c.el.style.visibility = zView > cfg.perspective - 60 ? 'hidden' : 'visible';
        }
        camDot.setAttribute('cx', mx(eye.x).toFixed(1));
        camDot.setAttribute('cy', mz(eye.z).toFixed(1));
      } else if (layout === 1) {
        // TUNNEL: infinity is a modulo, not a long corridor
        world.style.transform = `translateZ(${cfg.perspective - 200}px)`;
        const span = N * cfg.tunnelSpacing;
        for (const c of cards) {
          const z = mod(c.i * cfg.tunnelSpacing + s * 0.8, span) - span;
          const a = c.i * 2.4;
          const x = Math.cos(a) * 520, y = Math.sin(a) * 300;
          if (-z < best) { best = -z; nearest = c.i; }
          c.el.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
          c.el.style.opacity = fadeStr;
        }
      } else if (layout === 2) {
        // WHEEL: rotateY(θ) translateZ(r) rotateY(90deg) – cards tangential, knife-thin at near and far
        world.style.transform = `translateZ(${-cfg.wheelRadius * 1.5}px) rotateX(-24deg)`;
        const rot = s * 0.03;
        for (const c of cards) {
          const th = (c.i / N) * 360 + rot;
          const front = Math.cos(THREE.MathUtils.degToRad(th));
          if (-front < best) { best = -front; nearest = c.i; }
          c.el.style.transform = `rotateY(${th}deg) translateZ(${cfg.wheelRadius}px) rotateY(90deg)`;
          c.el.style.opacity = fadeStr;
        }
      } else {
        // FIBONACCI SPHERE: rotateY(lon) rotateX(lat) translateZ(r) puts each card tangent to the surface
        world.style.transform = `translateZ(${-cfg.sphereRadius * 0.6}px) rotateY(${s * 0.02}deg) rotateX(${Math.sin(s * 0.0004) * 15}deg)`;
        const ga = Math.PI * (3 - Math.sqrt(5));
        for (const c of cards) {
          const y = 1 - (c.i / (N - 1)) * 2;
          const lat = THREE.MathUtils.radToDeg(Math.asin(y));
          const lon = THREE.MathUtils.radToDeg(c.i * ga);
          c.el.style.transform = `rotateY(${lon}deg) rotateX(${lat}deg) translateZ(${cfg.sphereRadius}px) scale(.55)`;
          c.el.style.opacity = fadeStr;
        }
        nearest = mod(Math.round(-s * 0.02 / (360 / N)), N);
      }
      indexEl.textContent = `${String(nearest + 1).padStart(3, '0')} / ${String(N).padStart(3, '0')}`;
    })
  );

  return () => d.run();
}
