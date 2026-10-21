/* ==========================================================================
   work/index.js — an endless field of cards you drag through.

   THE FIELD IS A FIXED POOL OF CARDS, NOT AN ENDLESS LIST. Enough cards to
   cover the screen plus one ring are positioned with a modulo of the offset,
   so a card that leaves on one side re-enters on the other with the project
   its new virtual cell maps to. The per-frame work is one transform per card.

   THE PICTURES ARE DOM <img>, and the two effects that would tempt you into
   WebGL are kept by other means: chromatic aberration is an SVG filter whose
   R/B offsets follow drag velocity (switched off entirely at rest), and
   distortion is a per-card skew/squash.
   ========================================================================== */

import { PROJECTS } from '../content.js';
import { onFrame, damp, clamp, reducedMotion } from '../core/loop.js';
import { disposer } from '../core/lifecycle.js';
import { poster } from '../core/posters.js';
import { NOISE_JS } from './noise.js';

export const WORK_CONFIG = {
  cardW: 250, cardH: 330, gapX: 110, gapY: 120,
  ease: 5,              // ≈ lerp .08 at 60 fps
  bleed: 0.3,           // a horizontal drag bleeds 30% into vertical
  movingScale: 0.9,
  caMax: 9,             // px of R/B split at full speed
  skewMax: 6,           // deg
  blobScale: 6,         // blob canvas is 1/6 of the screen
  trail: 14,
};

const FIG = `<svg viewBox="0 0 18 40"><path d="M9 0a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM4 10h10l2 12h-3l-1 18h-3l-.5-12h-1L8 40H5L4 22H1z" fill="#fff"/></svg>`;

export function mount(root) {
  const cfg = WORK_CONFIG;
  const d = disposer();
  const field = root.querySelector('[data-field]');
  const cellW = cfg.cardW + cfg.gapX;
  const cellH = cfg.cardH + cfg.gapY;
  const posEl = root.querySelector('[data-work-pos]');
  const caR = root.querySelector('[data-ca-r]');
  const caB = root.querySelector('[data-ca-b]');

  // ---- pool ----
  let cols = 0, rows = 0, cards = [];
  const build = () => {
    cols = Math.ceil(innerWidth / cellW) + 2;
    rows = Math.ceil(innerHeight / cellH) + 2;
    field.innerHTML = '';
    cards = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const el = document.createElement('figure');
        el.className = 'card';
        el.innerHTML = `<div class="card__img"><img alt="" draggable="false" /></div><figcaption><span data-n></span><span data-t></span><span data-y></span></figcaption>`;
        field.appendChild(el);
        cards.push({ el, i, j, img: el.querySelector('img'), n: el.querySelector('[data-n]'), t: el.querySelector('[data-t]'), y: el.querySelector('[data-y]'), project: -1 });
      }
    }
  };
  build();
  d.on(window, 'resize', build);

  // ---- input ----
  const s = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, moving: 0 };
  let drag = null;
  d.on(window, 'wheel', (e) => {
    s.tx -= e.deltaX * 1.2;
    s.ty -= e.deltaY * 1.2;
  }, { passive: true });
  d.on(field, 'pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0, target: e.target.closest('.card') };
    field.setPointerCapture(e.pointerId);
  });
  d.on(field, 'pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    s.tx += dx * 1.4;
    s.ty += (dy + Math.abs(dx) * cfg.bleed * Math.sign(dy || 1)) * 1.4;
  });
  d.on(field, 'pointerup', () => {
    if (drag && drag.moved < 6 && drag.target) openLightbox(cards.find((c) => c.el === drag.target));
    drag = null;
  });

  // ---- cursor figure + blob trail ----
  const cursor = root.querySelector('[data-cursor]');
  cursor.innerHTML = FIG;
  const trail = [];
  d.on(window, 'pointermove', (e) => {
    cursor.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 6}px)`;
    trail.push({ x: e.clientX, y: e.clientY, age: 0 });
    if (trail.length > cfg.trail) trail.shift();
  });
  const blobs = root.querySelector('[data-blobs]');
  const bctx = blobs.getContext('2d');
  let bimg;
  const bsize = () => {
    blobs.width = Math.max(1, Math.ceil(innerWidth / cfg.blobScale));
    blobs.height = Math.max(1, Math.ceil(innerHeight / cfg.blobScale));
    bimg = bctx.createImageData(blobs.width, blobs.height);
  };
  bsize();
  d.on(window, 'resize', bsize);

  /* the torn edge: metaball distance + multi-octave noise BEFORE the threshold */
  const drawBlobs = (t) => {
    const W = blobs.width, H = blobs.height, data = bimg.data, k = cfg.blobScale;
    const pts = trail.filter((p) => p.age < 1.2);
    data.fill(0);
    if (pts.length) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let f = 0;
          for (const p of pts) {
            const dx = x - p.x / k, dy = y - p.y / k;
            const r = 7 * (1 - p.age / 1.2);
            f += (r * r) / (dx * dx + dy * dy + 1);
          }
          if (f < 0.35) continue;
          f += (NOISE_JS(x * 0.18, y * 0.18 + t) - 0.5) * 1.1;
          if (f > 1) {
            const o = (y * W + x) * 4;
            data[o] = 255; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 255;
          }
        }
      }
    }
    bctx.putImageData(bimg, 0, 0);
  };

  // ---- lightbox with pixelate reveal ----
  const lb = root.querySelector('[data-lightbox]');
  const lbCanvas = root.querySelector('[data-lb-canvas]');
  const lbCap = root.querySelector('[data-lb-caption]');
  let lbTimer = 0;
  function openLightbox(card) {
    if (!card) return;
    const p = PROJECTS[card.project];
    const img = new Image();
    img.onload = () => {
      const maxH = innerHeight * 0.72;
      const scale = maxH / img.height;
      lbCanvas.width = Math.round(img.width * scale);
      lbCanvas.height = Math.round(maxH);
      const g = lbCanvas.getContext('2d');
      const steps = reducedMotion ? [1] : [64, 32, 16, 8, 4, 1];
      let k = 0;
      clearInterval(lbTimer);
      const draw = () => {
        const b = steps[k];
        const w = Math.max(1, Math.ceil(lbCanvas.width / b));
        const h = Math.max(1, Math.ceil(lbCanvas.height / b));
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, lbCanvas.width, lbCanvas.height);
        g.drawImage(img, 0, 0, w, h);
        g.drawImage(lbCanvas, 0, 0, w, h, 0, 0, lbCanvas.width, lbCanvas.height);
        if (b === 1) { g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, lbCanvas.width, lbCanvas.height); }
        if (++k >= steps.length) clearInterval(lbTimer);
      };
      draw();
      lbTimer = setInterval(draw, 60);
    };
    img.src = card.img.src;
    lbCap.textContent = `${String(card.project + 1).padStart(2, '0')} / ${p.title} / ${p.year}`;
    lb.classList.add('is-open');
  }
  const closeLb = () => { lb.classList.remove('is-open'); clearInterval(lbTimer); };
  d.on(root.querySelector('[data-lb-close]'), 'click', closeLb);
  d.on(lb, 'click', (e) => e.target === lb && closeLb());
  d.on(window, 'keydown', (e) => e.key === 'Escape' && closeLb());
  d(() => clearInterval(lbTimer));

  // ---- frame ----
  const mod = (a, n) => ((a % n) + n) % n;
  let blobAcc = 0;
  d(
    onFrame((dt, t) => {
      const px = s.x, py = s.y;
      s.x = damp(s.x, s.tx, cfg.ease, dt);
      s.y = damp(s.y, s.ty, cfg.ease, dt);
      s.vx = (s.x - px) / Math.max(dt, 1e-3);
      s.vy = (s.y - py) / Math.max(dt, 1e-3);
      const speed = Math.hypot(s.vx, s.vy);
      s.moving = damp(s.moving, clamp(speed / 900), 6, dt);
      const W = cols * cellW, H = rows * cellH;
      const sc = 1 - (1 - cfg.movingScale) * s.moving;
      const skew = clamp(s.vx / 2000, -1, 1) * cfg.skewMax;
      const squash = 1 - clamp(Math.abs(s.vy) / 4000) * 0.12;
      const ox = (innerWidth - cellW * (cols - 2)) / 2;
      const oy = (innerHeight - cellH * (rows - 2)) / 2;
      for (const c of cards) {
        const rx = c.i * cellW + s.x;
        const ry = c.j * cellH + s.y;
        const x = mod(rx, W) - cellW + ox;
        const y = mod(ry, H) - cellH + oy;
        const vc = c.i - Math.floor(rx / W) * cols;
        const vr = c.j - Math.floor(ry / H) * rows;
        const proj = mod(vc * 3 + vr * 5, PROJECTS.length);
        if (proj !== c.project) {
          c.project = proj;
          const p = PROJECTS[proj];
          c.img.src = poster(p, proj);
          c.n.textContent = String(proj + 1).padStart(2, '0');
          c.t.textContent = p.title;
          c.y.textContent = p.year;
        }
        c.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${sc}) skewX(${skew}deg) scaleY(${squash})`;
      }
      // chromatic aberration only while moving: an idle SVG filter still costs a full repaint
      const ca = clamp(speed / 1500) * cfg.caMax;
      if (ca > 0.3 && !reducedMotion) {
        field.style.filter = 'url(#ca)';
        caR.setAttribute('dx', String(ca)); caB.setAttribute('dx', String(-ca));
        caR.setAttribute('dy', String(ca * 0.3)); caB.setAttribute('dy', String(-ca * 0.3));
      } else if (field.style.filter) field.style.filter = '';
      posEl.textContent = `X ${String(Math.abs(Math.round(-s.x / 10)) % 1000).padStart(3, '0')} // Y ${String(Math.abs(Math.round(-s.y / 10)) % 1000).padStart(3, '0')}`;

      for (const p of trail) p.age += dt;
      blobAcc += dt;
      if (blobAcc > 1 / 30) { blobAcc = 0; drawBlobs(t); }
    })
  );

  return () => d.run();
}
