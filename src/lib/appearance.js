// Apariencia de la app (solo en este celular): tema y tamaño de letra
const KEY = 'envia2:appearance';
export function getAppearance() {
  try {
    return { theme: 'auto', font: 'md', ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    return { theme: 'auto', font: 'md' };
  }
}
export function applyAppearance(a = getAppearance()) {
  const r = document.documentElement;
  if (a.theme === 'auto') delete r.dataset.theme;
  else r.dataset.theme = a.theme;
  r.dataset.font = a.font;
  const dark = a.theme === 'dark' || (a.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020c28' : '#0b2a7a');
}
export function setAppearance(patch) {
  const a = { ...getAppearance(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* sin almacenamiento */
  }
  applyAppearance(a);
  return a;
}
