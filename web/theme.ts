// ABOUTME: Restores the workspace palette before first paint and remembers explicit choices locally.
// ABOUTME: Runs as a bundled head script under the local server's self-only script policy.
export {};
const storageKey = 'devouch.theme.v1';
try {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch { /* Keep the default palette when browser storage is unavailable. */ }

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const toggle = document.querySelector<HTMLButtonElement>('#theme-toggle')!;
  const label = toggle.querySelector<HTMLElement>('.theme-label')!;
  const apply = (theme: 'dark' | 'light') => {
    root.dataset.theme = theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' mode');
    toggle.title = 'Switch to ' + next + ' mode';
    label.textContent = next === 'light' ? 'Light mode' : 'Dark mode';
  };
  apply(root.dataset.theme === 'light' ? 'light' : 'dark');
  toggle.disabled = false;
  toggle.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(theme);
    try { localStorage.setItem(storageKey, theme); }
    catch { /* The selected palette still works for this page when storage is blocked. */ }
  });
}, { once: true });
