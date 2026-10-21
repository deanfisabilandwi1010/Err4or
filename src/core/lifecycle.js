/* ==========================================================================
   lifecycle.js — mount / unmount per page.

   Barba swaps <main> without reloading, so anything a page starts (frame
   subscriptions, listeners, intervals, WebGL contexts) outlives the DOM it was
   built for unless something tears it down. Each page module is a function
   mount(container) that returns its own cleanup; this file only remembers the
   cleanups and runs them on leave.
   ========================================================================== */

const pages = new Map();
let active = null;

export function registerPage(namespace, loader) {
  pages.set(namespace, loader);
}

export async function mountPage(namespace, container, ctx = {}) {
  await unmountPage();
  const load = pages.get(namespace);
  if (!load) return;
  const mod = await load();
  const cleanup = await mod.mount(container, ctx);
  active = { namespace, cleanup };
  document.body.dataset.page = namespace;
}

export async function unmountPage() {
  if (!active) return;
  const { cleanup } = active;
  active = null;
  try {
    if (typeof cleanup === 'function') await cleanup();
  } catch (err) {
    console.warn('[lifecycle] cleanup failed', err);
  }
}

/* Small helper modules use: collect disposers and run them all once. */
export function disposer() {
  const fns = [];
  const add = (fn) => (fns.push(fn), fn);
  add.on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    fns.push(() => target.removeEventListener(type, fn, opts));
  };
  add.run = () => {
    while (fns.length) {
      try { fns.pop()(); } catch (err) { console.warn('[dispose]', err); }
    }
  };
  return add;
}
