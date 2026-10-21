/* ==========================================================================
   chrome.js — what every page shares and nothing unmounts:
   film grain, the bottom bar with its live clock, the logo slots,
   and the console banner.
   ========================================================================== */

import { OWNER } from '../content.js';
import { logoSVG } from './logo.js';
import { onFrame, reducedMotion } from './loop.js';

const NAV = [
  { ns: 'home', href: '/', label: 'INDEX' },
  { ns: 'work', href: '/work.html', label: 'WORK' },
  { ns: 'gallery', href: '/gallery.html', label: 'GALLERY' },
  { ns: 'error', href: '/404.html', label: 'ERROR' },
];

export function navHTML() {
  return NAV.map((n) => `<a href="${n.href}" data-nav="${n.ns}">${n.label} <i>+</i></a>`).join('');
}

export function initChrome() {
  document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = logoSVG()));
  initBar();
  initGrain();
}

/* ---- BOTTOM BAR -------------------------------------------------------- */
function initBar() {
  const bar = document.querySelector('[data-bar]');
  if (!bar) return;
  bar.innerHTML = `
    <nav class="bar__nav" aria-label="Main">${navHTML()}</nav>
    <div class="bar__right">
      <span>${OWNER.gmt}</span><i class="bar__dot">●</i><span data-clock>00:00:00</span>
      <a class="bar__cta" href="${OWNER.contactHref}">${OWNER.contactLabel} <span>+</span></a>
    </div>`;
  const clock = bar.querySelector('[data-clock]');
  const pad = (n) => String(n).padStart(2, '0');
  const tickClock = () => {
    const d = new Date();
    clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tickClock();
  setInterval(tickClock, 1000);
  setActiveNav(document.body.dataset.page);
}

export function setActiveNav(ns) {
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === ns));
}

/* ---- FILM GRAIN ---------------------------------------------------------
   Drawn at a quarter resolution and stretched with pixelated sampling: grain
   is supposed to be coarse, and a quarter of the pixels is a sixteenth of the
   work. Redrawn at 24 fps, not 60 – film grain at 60 reads as TV static. */
function initGrain() {
  const c = document.querySelector('.grain');
  if (!c) return;
  const ctx = c.getContext('2d');
  let img;
  const size = () => {
    // a document can load before it has a size (hidden tab, emulation); never ask for 0×0
    c.width = Math.max(1, Math.ceil(innerWidth / 4));
    c.height = Math.max(1, Math.ceil(innerHeight / 4));
    img = ctx.createImageData(c.width, c.height);
  };
  size();
  addEventListener('resize', size);
  const draw = () => {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  draw();
  if (reducedMotion) return;
  let acc = 0;
  onFrame((dt) => {
    acc += dt;
    if (acc < 1 / 24) return;
    acc = 0;
    draw();
  });
}

/* ---- CONSOLE ----------------------------------------------------------- */
const BANNER = String.raw`
 ██████   ██████
 ██  ┌──────┐  ██      CASE FILE 0039
 ██  │ ■■■■ │  ██      ACCESS LEVEL: VISITOR
 ██  └──────┘  ██      THIS SESSION IS BEING OBSERVED
 ██████   ██████`;

export function consoleBanner(ns) {
  const red = 'color:#e8271c;font-family:monospace;font-size:11px';
  const dim = 'color:#888;font-family:monospace';
  console.log(`%c${BANNER}`, red);
  console.log(`%c[PROTOCOL] page=${ns} // ${new Date().toISOString()} // subject=${OWNER.name}`, dim);
}
