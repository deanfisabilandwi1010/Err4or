/* ==========================================================================
   home/index.js — the home page: one scroll, four phases.

     0 → A   the case file runs up both sides, the figure turns   (block 01)
     A → B   black tears to white                                  (ground.js)
     B → C   the white room: the head, crosses, numerals, words    (block 02)
     C → D   the red room: multiply sheet, headline, black band    (footer)

   Every phase is a RANGE OF THE SAME NUMBER (window.SCROLL.current), read here
   once per frame and handed to each part, so scrolling back up reverses all of
   it exactly – block 02 is back at 0 before the tear starts closing because
   they are consecutive ranges of one value, not two timelines.
   ========================================================================== */

import gsap from 'gsap';
import { onFrame, ramp, clamp, reducedMotion } from '../core/loop.js';
import { disposer } from '../core/lifecycle.js';
import { createTravel } from '../core/travel.js';
import { preload, ASSETS } from '../three/assets.js';
import { buildHome } from './dom.js';
import { runLoader } from './loader.js';
import { createFigure } from './figure.js';
import { createHead } from './head.js';
import { createGround } from './ground.js';
import { createMiniFigure } from './minimap.js';
import { createSyslog } from './syslog.js';

export const HOME_CONFIG = {
  copyStart: 0.98,  // where the case file starts, in viewport heights from the top
  copyRevealAt: 0.9, // a line blurs in when it rises above this share of the viewport
  rowPitch: 17,     // px between rows; rows alternate sides, so one side reads 34px apart
  titleGap: 80,     // px from the case-file title to the first row
  shapeGap: 22,     // px of clear space between a line and the figure's silhouette
  shapeMin: 40,     // px: the narrowest the copy may close up where there is no figure
  tearLen: 1.2,     // phase lengths in viewport heights
  block2Len: 1.6,
  footerLen: 1.4,
  glitchEvery: 0.12,
  logSpeed: 0.35,   // px the HUD's error log travels per px of scroll
};

export async function mount(root, ctx) {
  const cfg = HOME_CONFIG;
  const d = disposer();
  const $ = (s) => root.querySelector(s);
  buildHome(root);

  const travel = createTravel();
  d(() => travel.destroy());

  // ---- load: bytes are 90% of the bar, building the scenes the last 10% ----
  let bytes = 0;
  let built = 0;
  const loaderEl = $('[data-loader]');
  const loading = (async () => {
    await preload(Object.values(ASSETS), (p) => (bytes = p)).catch((e) => console.warn('[home] preload', e));
    const [figure, head, mini] = await Promise.all([
      createFigure($('[data-fig]')).catch((e) => (console.warn('[home] figure fallback:', e), null)),
      createHead($('[data-head]')).catch((e) => (console.warn('[home] head fallback:', e), null)),
      createMiniFigure($('[data-mini]')).catch((e) => (console.warn('[home] minimap fallback:', e), null)),
    ]);
    let ground = null;
    try { ground = createGround($('[data-bg]')); } catch (e) { console.warn('[home] ground fallback:', e); }
    built = 1;
    return { figure, head, ground, mini };
  })();
  if (ctx.first && loaderEl) await runLoader(loaderEl, () => bytes * 0.9 + built * 0.1);
  else loaderEl?.remove();
  const { figure, head, ground, mini } = await loading;
  if (figure) d(() => figure.dispose()); else root.classList.add('no-figure');
  if (head) d(() => head.dispose());
  if (ground) d(() => ground.dispose());
  if (mini) { d(() => mini.dispose()); $('[data-map]').classList.add('has-mini'); }

  if (head) travel.setFilter((dy, e) => (head.wheel(dy, e) ? 0 : dy));

  // ---- the footer's red sheet. A blend mode only sees the backdrop inside its own stacking
  // context, and <main> is position:fixed (= a stacking context), so the sheet goes INSIDE it,
  // between block 02 and the footer: multiply then reaches everything below and nothing above.
  const sheet = document.createElement('div');
  sheet.className = 'red-sheet';
  $('[data-ftr]').before(sheet);
  d(() => sheet.remove());

  // ---- measure ----
  const track = $('[data-copy-track]');
  const lines = [...root.querySelectorAll('.copy .line')];
  const b1 = $('[data-b1]');
  const b2 = $('[data-b2]');
  const ftr = $('[data-ftr]');
  const hud = $('[data-hud]');
  const progressBar = $('[data-progress]');
  const progressN = $('[data-progress-n]');
  const log = createSyslog($('[data-log]'));
  let A = 1, B = 2, C = 3, D = 4, vh = innerHeight;
  let tops = [];
  let widths = [];
  const lastX = lines.map(() => NaN);
  const isRight = lines.map((l) => l.classList.contains('is-r'));
  const measure = () => {
    vh = innerHeight;
    tops = lines.map((_, i) => cfg.titleGap + i * cfg.rowPitch);
    lines.forEach((l, i) => (l.style.top = `${tops[i]}px`));
    widths = lines.map((l) => l.offsetWidth);
    const trackH = cfg.titleGap + lines.length * cfg.rowPitch;
    track.style.height = `${trackH}px`;
    A = trackH + vh * cfg.copyStart;
    B = A + vh * cfg.tearLen;
    C = B + vh * cfg.block2Len;
    D = C + vh * cfg.footerLen;
    travel.setMax(D);
  };
  measure();
  document.fonts?.ready.then(measure);
  d.on(window, 'resize', measure);

  // ---- HUD live parts ----
  const sq = $('[data-sq]');
  const map = $('[data-map]');
  const xEl = $('[data-x]');
  const yEl = $('[data-y]');
  let eyeTiltTarget = 0;
  const pad3 = (n) => String(Math.round(n)).padStart(3, '0');
  d.on(window, 'pointermove', (e) => {
    const u = clamp(e.clientX / Math.max(1, innerWidth));
    const v = clamp(e.clientY / Math.max(1, innerHeight));
    sq.style.transform = `translate(${u * (map.clientWidth - 6)}px, ${v * (map.clientHeight - 6)}px)`;
    xEl.textContent = `X ${pad3(u * 999)}`;
    yEl.textContent = `Y ${pad3(v * 999)}`;
    eyeTiltTarget = (u - 0.5) * 6;
  });

  // ---- copy glitch: a letter becomes a digit for two frames ----
  let glitchAcc = 0;
  let glitched = null;
  const glitch = (dt) => {
    if (reducedMotion) return;
    if (glitched) { glitched.el.textContent = glitched.text; glitched = null; }
    glitchAcc += dt;
    if (glitchAcc < cfg.glitchEvery) return;
    glitchAcc = 0;
    const vis = lines.filter((l) => l.classList.contains('in'));
    if (!vis.length) return;
    const span = vis[(Math.random() * vis.length) | 0].firstElementChild;
    const text = span.textContent;
    const i = (Math.random() * text.length) | 0;
    if (!/[a-z]/i.test(text[i])) return;
    span.textContent = text.slice(0, i) + ((Math.random() * 10) | 0) + text.slice(i);
    glitched = { el: span, text };
  };

  // ---- block 02 / footer DOM ----
  const crossH = root.querySelector('.cross--h');
  const crossV = root.querySelector('.cross--v');
  const numeral = $('[data-numeral]');
  const cols = [...root.querySelectorAll('.words__col')];
  const ftrLines = [...root.querySelectorAll('.ftr__line > span')];
  const band = root.querySelector('[data-band]');
  const hole = root.querySelector('[data-hole]');
  const lower = $('[data-ftr-lower]');
  let eyeTilt = 0;
  let blinkT = 0;
  const b2Meta = root.querySelectorAll('.b2__meta, .b2__hint');

  // ---- entrance (held until the loader is gone) ----
  if (!reducedMotion) {
    gsap.from(root.querySelectorAll('.hud__panel, .hud__coord, .hud__br'), { opacity: 0, filter: 'blur(8px)', duration: 0.9, stagger: 0.08, ease: 'power3.out' });
    gsap.from('[data-fig]', { opacity: 0, duration: 1.4, ease: 'power2.out' });
  }

  // ---- dev dials ----
  if (import.meta.env.DEV) {
    window.TUNE = { figure, head, ground, config: cfg };
    import('lil-gui').then(({ default: GUI }) => {
      const gui = new GUI({ title: 'TUNE', width: 240 });
      gui.close();
      Object.assign(gui.domElement.style, { top: 'auto', bottom: '40px', right: '18px' });
      d(() => gui.destroy());
      if (figure) {
        const f = gui.addFolder('figure');
        const u = figure.materials.body.uniforms;
        f.add(u.uTone, 'value', 0, 1.5).name('tone');
        f.add(u.uDots, 'value', 0, 1).name('rgb dots');
        f.add(u.uIri, 'value', 0, 1).name('rainbow');
        f.add(u.uScan, 'value', 0, 1).name('scan');
        f.add(u.uGrain, 'value', 0, 0.3).name('grain');
        if (figure.materials.skeleton) f.add(figure.materials.skeleton.uniforms.uFresnel, 'value', 0, 3).name('xray fresnel');
        f.add(figure.stage.fluid, 'radius', 0.02, 0.3).name('brush');
      }
      if (head) {
        const h = gui.addFolder('head');
        h.add(head.materials.mask.uniforms.uHi, 'value', 0, 1).name('mask → face');
        h.add(head.materials.face.uniforms.uHi, 'value', 0, 1).name('face → skull');
        h.add(head.materials.face.uniforms.uRevGlow, 'value', 0, 3).name('red edge');
      }
    });
  }

  // ---- the frame ----
  d(
    onFrame((dt, t) => {
      const cur = travel.current;
      const p1 = ramp(cur, 0, A);
      const pT = ramp(cur, A, B);
      const p2 = ramp(cur, B, C);
      const pF = ramp(cur, C, D);

      // block 01
      const y0 = vh * cfg.copyStart - Math.min(cur, A);
      track.style.transform = `translate3d(0, ${y0}px, 0)`;
      const edge = vh * cfg.copyRevealAt;
      for (let i = 0; i < lines.length; i++) {
        const y = y0 + tops[i];
        const isIn = y < edge;
        if (isIn !== lines[i].classList.contains('in')) lines[i].classList.toggle('in', isIn);
      }
      glitch(dt);
      progressBar.style.transform = `scaleX(${p1})`;
      progressN.textContent = String(Math.round(p1 * 100)).padStart(3, '0');
      hud.style.opacity = String(1 - ramp(pT, 0, 0.35));
      log.update(cur * cfg.logSpeed);
      const b1Live = pT < 1;
      b1.style.visibility = b1Live ? 'visible' : 'hidden';
      if (figure && b1Live) figure.update(dt, t, { scroll01: p1, paint: pT < 0.05 });
      if (mini && b1Live) mini.update(dt, t);

      // THE COPY PARTS AROUND THE FIGURE: each row's inner end sits shapeGap px from the
      // silhouette at that height (read back by figure.js), left rows ending before it,
      // right rows starting after it. Rows off screen are skipped.
      if (b1Live) {
        const mid = innerWidth / 2;
        for (let i = 0; i < lines.length; i++) {
          const y = y0 + tops[i];
          if (y < -40 || y > vh + 40) continue;
          let [l, r] = figure?.edgeAt(y - 2, y + 15) || [mid, mid];
          if (r - l < cfg.shapeMin) { const c = (l + r) / 2; l = c - cfg.shapeMin / 2; r = c + cfg.shapeMin / 2; }
          const x = isRight[i] ? r + cfg.shapeGap : l - cfg.shapeGap - widths[i];
          if (Math.abs(x - lastX[i]) > 0.3 || Number.isNaN(lastX[i])) {
            lastX[i] = x;
            lines[i].style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
          }
        }
      }

      // the tear + the ground
      ground?.update(t, pT, pF);

      // block 02
      const b2Show = ramp(pT, 0.7, 1);
      b2.style.opacity = String(b2Show);
      b2.style.visibility = b2Show > 0 ? 'visible' : 'hidden';
      const p2f = p2 + pF; // block 02 keeps travelling under the footer
      if (head) {
        // the head stays live through the red room: it keeps following the pointer and opening
        head.setActive(pT >= 1);
        travel.dragEnabled = !head.active;
        if (b2Show > 0) head.update(dt, t);
      }
      crossH.style.transform = `translate3d(${-18 + p2f * 22}vw, ${-6 + p2f * 4}vh, 0) rotate(${-4 + p2f * 10}deg)`;
      crossV.style.transform = `translate3d(${8 - p2f * 6}vw, ${-30 + p2f * 30}vh, 0) rotate(${3 - p2f * 8}deg)`;
      numeral.style.transform = `translate3d(0, ${20 - p2f * 50}vh, 0) rotate(-90deg)`;
      cols.forEach((c, i) => (c.style.transform = `translate3d(0, ${-p2f * (90 + i * 35)}vh, 0)${c.classList.contains('is-mirror') ? ' scaleX(-1)' : ''}${c.classList.contains('is-flip') ? ' rotate(180deg)' : ''}`));

      // footer
      sheet.style.opacity = String(pF);
      ftr.style.visibility = pF > 0 ? 'visible' : 'hidden';
      ftrLines.forEach((l, i) => (l.style.transform = `translate3d(0, ${(1 - ramp(pF, 0.55 + i * 0.1, 0.7 + i * 0.1)) * 105}%, 0)`));
      const bandIn = ramp(pF, 0.7, 0.9);
      band.style.transform = `translate3d(0, ${(1 - bandIn) * 60}vh, 0)`;
      band.style.visibility = bandIn > 0 ? 'visible' : 'hidden';
      const lowerIn = ramp(pF, 0.82, 1);
      lower.style.transform = `translate3d(0, ${(1 - lowerIn) * 30}vh, 0)`;
      lower.style.opacity = String(lowerIn);
      b2Meta.forEach((m) => (m.style.opacity = String(1 - ramp(pF, 0.3, 0.6))));
      // the eye: tilts toward the pointer, blinks every few seconds
      if (bandIn > 0) {
        eyeTilt += (eyeTiltTarget - 3 - eyeTilt) * (1 - Math.exp(-dt * 3));
        blinkT = (blinkT + dt) % 4.2;
        const blink = blinkT > 3.95 ? Math.sin(((blinkT - 3.95) / 0.25) * Math.PI) : 0;
        hole.setAttribute('ry', (38 * (1 - blink * 0.95)).toFixed(2));
        hole.setAttribute('transform', `rotate(${eyeTilt.toFixed(2)} 500 100)`);
      }
      document.body.classList.toggle('is-red', pF > 0.5);
      document.body.classList.toggle('is-footer', pF > 0.85);
    })
  );

  return () => {
    d.run();
    document.body.classList.remove('is-red', 'is-footer');
    delete window.TUNE;
  };
}

