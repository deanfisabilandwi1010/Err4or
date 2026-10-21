/* ==========================================================================
   transition.js — Barba page transitions.

   DEFAULT: THE PIXEL WIPE. The incoming container is already in place, pinned
   to the viewport on top of the old one, and revealed by a clip-path that opens
   in discrete steps – one per grid column – while that column's squares flash
   on and off just ahead of the edge. The flicker riding the hard step is the
   whole effect; the clip alone reads as a plain wipe.

   The other three styles are kept as dials (STYLE below), not deleted, so a
   page can ask for a different door later.
   ========================================================================== */

import { onFrame, reducedMotion } from './loop.js';

export const TRANSITION = {
  style: 'pixel',   // 'pixel' | 'liquid' | 'iris' | 'sheet'
  cols: 16,
  duration: 0.7,
};

const liquidEase = (t) => 1 - Math.pow(1 - Math.pow(t, 1.74), 3.92); // measured, see brief §13

function animate(duration, fn) {
  return new Promise((resolve) => {
    let t = 0;
    const off = onFrame((dt) => {
      t = Math.min(1, t + dt / duration);
      fn(t);
      if (t >= 1) { off(); resolve(); }
    });
  });
}

function pin(el) {
  // EXPLICIT viewport height: a fixed child of a clipped/transformed parent resolves against
  // the parent, so the container has to be exactly one viewport tall or the bar drifts.
  Object.assign(el.style, { position: 'fixed', inset: '0', height: '100dvh', zIndex: 600 });
}
function unpin(el) {
  ['position', 'inset', 'height', 'zIndex', 'clipPath', 'opacity', 'transform'].forEach((p) => (el.style[p] = ''));
}

export async function runTransition(next) {
  pin(next);
  const style = reducedMotion ? 'fade' : TRANSITION.style;
  if (style === 'fade') {
    await animate(0.35, (t) => (next.style.opacity = t));
  } else if (style === 'pixel') {
    await pixelWipe(next);
  } else if (style === 'liquid') {
    await animate(0.8, (t) => {
      const e = liquidEase(t);
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const x = (i / 24) * 100;
        const n = Math.sin(i * 1.7 + t * 9) * 3 + Math.sin(i * 0.6 - t * 5) * 4;
        pts.push(`${x}% ${Math.max(0, 100 - e * 112 + n * (1 - e))}%`);
      }
      next.style.clipPath = `polygon(0% 100%, ${pts.join(',')}, 100% 100%)`;
    });
  } else if (style === 'iris') {
    await animate(0.7, (t) => (next.style.clipPath = `circle(${liquidEase(t) * 75}% at 50% 50%)`));
  } else if (style === 'sheet') {
    await animate(0.7, (t) => (next.style.transform = `translateY(${(1 - liquidEase(t)) * 100}%)`));
  }
  unpin(next);
}

async function pixelWipe(next) {
  const { cols, duration } = TRANSITION;
  const grid = document.querySelector('.wipe');
  const rows = Math.ceil(innerHeight / (innerWidth / cols));
  grid.innerHTML = '<i></i>'.repeat(cols * rows);
  const cells = [...grid.children];
  next.style.clipPath = 'inset(0 100% 0 0)';
  let lastStep = -1;
  await animate(duration, (t) => {
    const step = Math.min(cols, Math.floor(t * cols + 0.0001));
    if (step !== lastStep) {
      lastStep = step;
      next.style.clipPath = `inset(0 ${100 - (step / cols) * 100}% 0 0)`;
    }
    // flash the column(s) just ahead of the edge
    for (let i = 0; i < cells.length; i++) {
      const c = i % cols;
      const ahead = c - step;
      cells[i].style.opacity = ahead >= 0 && ahead < 2 && Math.random() > 0.45 + ahead * 0.2 ? 1 : 0;
    }
  });
  grid.innerHTML = '';
}
