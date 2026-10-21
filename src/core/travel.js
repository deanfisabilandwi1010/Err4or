/* ==========================================================================
   travel.js — the scroll that isn't one.

   html/body never scroll. Wheel, drag, touch and keys all add to ONE target
   number; each frame the current value eases toward it against real elapsed
   time. Every module on a page reads that same number (window.SCROLL), so the
   figure's turn, the HUD progress bar, the copy, the tear and the red footer
   can never disagree about where you are.
   ========================================================================== */

import { onFrame, damp, clamp } from './loop.js';

export function createTravel({ el = window, max = 1000, ease = 8, drag = true, keys = true, wheelGain = 1 } = {}) {
  const state = { target: 0, current: 0, velocity: 0, max, progress: 0, dragEnabled: drag };
  const off = [];
  let pointerId = null;
  let lastY = 0;
  let lastTouch = 0;
  let filter = null; // optional: (deltaY, event) => deltaY to use (or 0 to consume)

  const add = (d) => {
    state.target = clamp(state.target + d, 0, state.max);
  };

  const wheel = (e) => {
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;          // lines → px
    else if (e.deltaMode === 2) d *= innerHeight;
    if (filter) d = filter(d, e);
    if (d) add(d * wheelGain);
  };
  const down = (e) => {
    if (!state.dragEnabled || e.button !== 0 || e.shiftKey || e.target.closest('a, button')) return;
    pointerId = e.pointerId;
    lastY = e.clientY;
  };
  const move = (e) => {
    if (e.pointerId !== pointerId) return;
    add((lastY - e.clientY) * 1.6);
    lastY = e.clientY;
  };
  const up = (e) => {
    if (e.pointerId === pointerId) pointerId = null;
  };
  const tstart = (e) => (lastTouch = e.touches[0].clientY);
  const tmove = (e) => {
    const y = e.touches[0].clientY;
    add((lastTouch - y) * 2);
    lastTouch = y;
  };
  const key = (e) => {
    if (!keys) return;
    const step = { ArrowDown: 80, ArrowUp: -80, PageDown: innerHeight * 0.8, PageUp: -innerHeight * 0.8, ' ': innerHeight * 0.6 }[e.key];
    if (step !== undefined) { add(step); e.preventDefault(); }
    if (e.key === 'End') state.target = state.max;
  };

  const listen = (t, type, fn, o) => { t.addEventListener(type, fn, o); off.push(() => t.removeEventListener(type, fn, o)); };
  listen(el, 'wheel', wheel, { passive: true });
  listen(el, 'pointerdown', down);
  listen(window, 'pointermove', move);
  listen(window, 'pointerup', up);
  listen(el, 'touchstart', tstart, { passive: true });
  listen(el, 'touchmove', tmove, { passive: true });
  listen(window, 'keydown', key);

  off.push(
    onFrame((dt) => {
      const prev = state.current;
      state.current = damp(state.current, state.target, ease, dt);
      if (Math.abs(state.current - state.target) < 0.01) state.current = state.target;
      state.velocity = (state.current - prev) / Math.max(dt, 1e-4);
      state.progress = state.max ? state.current / state.max : 0;
    })
  );

  window.SCROLL = state;
  return Object.assign(state, {
    add,
    setMax(m) { state.max = m; state.target = clamp(state.target, 0, m); },
    setFilter(fn) { filter = fn; },
    destroy() { off.forEach((f) => f()); if (window.SCROLL === state) delete window.SCROLL; },
  });
}
