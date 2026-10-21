/* ==========================================================================
   error/index.js — the broken tube. The logo exploded into fragments drifting
   in the corners, a cyan/white tear sweeping down every few seconds, and a
   console that keeps typing to nobody.
   ========================================================================== */

import { LOGO_PARTS } from '../core/logo.js';
import { onFrame, reducedMotion } from '../core/loop.js';
import { disposer } from '../core/lifecycle.js';

const LOG = [
  'PROTOCOL WARNING // 404', 'TRACE ROUTE ........ FAILED', 'MEMORY 0x00039 ...... CORRUPT', 'SUBJECT LOCATION ... UNKNOWN',
  'REQUEST ............ DENIED', 'RETRYING IN 3 2 1', 'SIGNAL ............. LOST', 'HANDSHAKE .......... REFUSED',
  'ARCHIVE ............ EMPTY', 'YOU SHOULD NOT BE HERE', 'REBUILDING INDEX ... 12%', 'CHECKSUM ........... MISMATCH',
];

export function mount(root) {
  const d = disposer();
  const frags = root.querySelector('[data-frags]');
  const ascii = root.querySelector('[data-ascii]');
  const tear = root.querySelector('[data-tear]');
  const barcode = root.querySelector('[data-barcode]');

  // four fragments of the mark, one per corner, each turning at its own pace
  const corners = [[-6, -8], [62, -10], [-8, 58], [64, 60]];
  const parts = [LOGO_PARTS[0], LOGO_PARTS[1], LOGO_PARTS[0], LOGO_PARTS[1]];
  frags.innerHTML = parts
    .map((p, i) => `<svg class="frag" viewBox="0 0 100 100" style="left:${corners[i][0]}vw;top:${corners[i][1]}vh"><path d="${p}" fill="#000"/></svg>`)
    .join('');
  const fragEls = [...frags.children];

  let bars = '';
  for (let x = 0; x < 120; ) {
    const w = 0.5 + Math.random() * 2.5;
    if (Math.random() > 0.4) bars += `<rect x="${x}" y="0" width="${w}" height="24" fill="#000"/>`;
    x += w + 0.4;
  }
  barcode.innerHTML = bars;

  const lines = [];
  const pushLine = () => {
    const n = (Math.random() * 1e6) | 0;
    lines.push(`${String(n).padStart(7, '0')}  ${LOG[(Math.random() * LOG.length) | 0]}`);
    if (lines.length > 34) lines.shift();
    ascii.textContent = lines.join('\n');
  };
  for (let i = 0; i < 20; i++) pushLine();
  let acc = 0;
  let tearT = 0;

  d(
    onFrame((dt, t) => {
      fragEls.forEach((el, i) => {
        const a = t * (6 + i * 3) * (i % 2 ? -1 : 1);
        el.style.transform = `rotate(${a}deg) scale(${1 + Math.sin(t * 0.7 + i) * 0.04})`;
      });
      acc += dt;
      if (acc > 0.18) { acc = 0; pushLine(); }
      if (reducedMotion) return;
      tearT += dt;
      const cycle = tearT % 3;
      const on = cycle < 0.45;
      tear.style.opacity = on ? '1' : '0';
      if (on) tear.style.transform = `translateY(${(cycle / 0.45) * 100}vh) scaleY(${1 + Math.random() * 2})`;
      root.querySelector('.err').classList.toggle('is-glitch', on && Math.random() > 0.5);
    })
  );
  return () => d.run();
}
