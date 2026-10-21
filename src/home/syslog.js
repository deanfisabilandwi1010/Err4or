/* ==========================================================================
   syslog.js — the HUD's error log: an endless, scroll-driven list.

   Line n is built from a hash of n alone, so the log is as long as the scroll
   is, never shows the same block twice, and reads back identically when the
   visitor scrolls up. Only the rows that fit are in the DOM; they are
   recycled, re-labelled when the first visible line number changes, and the
   track is moved by the remainder.
   ========================================================================== */

import { SYSLOG } from '../content.js';

const ROW = 12; // px per line, matches .hud__log li in home.css

/* integer → well-mixed 32 bits (one round of a murmur-style finaliser) */
const hash = (n, salt) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};
const hex = (n, len) => n.toString(16).toUpperCase().padStart(len, '0').slice(-len);

function line(n) {
  const pick = (arr, salt) => arr[hash(n, salt) % arr.length];
  if (hash(n, 7) % 11 === 0) {
    return { cls: 'is-head', code: pick(SYSLOG.headers, 3), msg: `PID ${1000 + (hash(n, 5) % 9000)}`, state: '' };
  }
  const state = pick(SYSLOG.states, 2);
  return {
    cls: state === 'FATAL' ? 'is-fatal' : state === 'WARN' || state === 'RETRY' ? 'is-dim' : '',
    code: `0x${hex(hash(n, 4), 6)}`,
    msg: pick(SYSLOG.messages, 1),
    state,
  };
}

export function createSyslog(list) {
  const rows = Math.ceil(list.parentElement.clientHeight / ROW) + 1;
  list.innerHTML = Array.from({ length: rows }, () => '<li><span></span><span></span><b></b></li>').join('');
  const els = [...list.children].map((li) => [li, ...li.children]);
  let first = NaN;

  return {
    /* offset: px of log scrolled past */
    update(offset) {
      const n = Math.floor(offset / ROW);
      if (n !== first) {
        first = n;
        els.forEach(([li, code, msg, state], i) => {
          const l = line(n + i);
          li.className = l.cls;
          code.textContent = l.code;
          msg.textContent = l.msg;
          state.textContent = l.state;
        });
      }
      list.style.transform = `translate3d(0, ${(-(offset - n * ROW)).toFixed(1)}px, 0)`;
    },
  };
}
