/* ==========================================================================
   loader.js — the intro, in five beats:
     1. the copy blurs in
     2. the percentage counts, driven by REAL load progress
     3. the copy travels left → right and exits while a 3px red line grows
     4. at 100% the red floods upward and takes the screen; while it is still
        rising, a black panel goes over it
     5. the page's own entrance starts (the caller awaits this promise)

   The cover panel is the black room's own colour, so the frame the loader
   leaves behind is identical to the page under it: no seam, no cut.

   The count is floored at 1.2s: a warm cache would otherwise flash 0 → 100 in a
   frame, which is a glitch, not a load.
   ========================================================================== */

import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { onFrame, ramp, reducedMotion } from '../core/loop.js';

gsap.registerPlugin(CustomEase);
CustomEase.create('flood', '0.7,0,0.15,1');

export function runLoader(el, getProgress, { minSeconds = 1.2 } = {}) {
  const lines = el.querySelectorAll('.anim-line');
  const copy = el.querySelector('[data-loader-copy]');
  const pct = el.querySelector('[data-loader-pct]');
  const line = el.querySelector('[data-loader-line]');
  const red = el.querySelector('[data-loader-red]');
  const cover = el.querySelector('[data-loader-white]');

  gsap.fromTo(lines, { filter: 'blur(10px)', opacity: 0, y: 12 }, { filter: 'blur(0px)', opacity: 1, y: 0, stagger: 0.05, duration: 0.7, ease: 'power3.out' });

  return new Promise((resolve) => {
    const start = performance.now();
    let shown = 0;
    const off = onFrame(() => {
      const elapsed = (performance.now() - start) / 1000;
      shown = Math.max(shown, Math.min(getProgress(), elapsed / minSeconds));
      pct.textContent = String(Math.floor(shown * 100)).padStart(3, '0');
      line.style.transform = `scaleX(${shown})`;
      const travel = ramp(shown, 0.15, 1);
      copy.style.transform = `translateX(${travel * 70}vw)`;
      copy.style.opacity = 1 - ramp(shown, 0.8, 1);
      if (shown >= 1) {
        off();
        finish();
      }
    });

    function finish() {
      if (reducedMotion) {
        gsap.to(el, { opacity: 0, duration: 0.3, onComplete: done });
        return;
      }
      const tl = gsap.timeline({ onComplete: done });
      tl.to(pct, { opacity: 0, duration: 0.15 }, 0);
      tl.to(red, { height: '100%', duration: 0.65, ease: 'flood' }, 0);
      tl.to(cover, { height: '100%', duration: 0.65, ease: 'flood' }, 0.3);
    }
    function done() {
      el.remove();
      resolve();
    }
  });
}
