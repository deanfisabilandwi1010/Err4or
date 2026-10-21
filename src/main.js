/* ==========================================================================
   main.js — the one script every page loads.
   ========================================================================== */

import './styles/base.css';
import './styles/home.css';
import './styles/work.css';
import './styles/gallery.css';
import './styles/error.css';

import barba from '@barba/core';
import { initChrome, setActiveNav, consoleBanner } from './core/chrome.js';
import { registerPage, mountPage, unmountPage } from './core/lifecycle.js';
import { runTransition } from './core/transition.js';

registerPage('home', () => import('./home/index.js'));
registerPage('work', () => import('./work/index.js'));
registerPage('gallery', () => import('./gallery/index.js'));
registerPage('error', () => import('./error/index.js'));

initChrome();

if (!document.documentElement.classList.contains('gated')) {
  const container = document.querySelector('[data-barba="container"]');
  const ns = container.dataset.barbaNamespace;
  consoleBanner(ns);
  mountPage(ns, container, { first: true });

  barba.init({
    preventRunning: true,
    prevent: ({ el }) => el.href && (el.href.startsWith('mailto:') || el.target === '_blank'),
    transitions: [
      {
        name: 'wipe',
        sync: true,
        beforeLeave: () => unmountPage(),
        beforeEnter: ({ next }) => {
          setActiveNav(next.namespace);
          consoleBanner(next.namespace);
          return mountPage(next.namespace, next.container, { first: false });
        },
        enter: ({ next }) => runTransition(next.container),
      },
    ],
  });
}
