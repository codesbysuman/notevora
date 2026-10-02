import { THEME_KEY } from '../config.js';

export function initTheme(dom) {
  const saved = localStorage.getItem(THEME_KEY);
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  
  applyTheme(dom, saved || (mql?.matches ? 'dark' : 'light'));

  dom['btn-theme-toggle']?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(dom, current === 'dark' ? 'light' : 'dark');
  });

  mql?.addEventListener('change', event => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(dom, event.matches ? 'dark' : 'light');
    }
  });
}

export function applyTheme(dom, theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  if (dom['theme-icon']) {
    dom['theme-icon'].textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  }

  // 1. Target the top-bar background color (#ffffff or #131b2e)
  const targetColor = theme === 'dark' ? '#131b2e' : '#ffffff';

  // 2. Remove and re-create meta tag to force Android Chrome to re-read icon contrast
  document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove());
  
  const newMeta = document.createElement('meta');
  newMeta.setAttribute('name', 'theme-color');
  newMeta.setAttribute('content', targetColor);
  document.head.appendChild(newMeta);
}
