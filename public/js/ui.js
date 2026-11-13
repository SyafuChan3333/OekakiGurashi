// 小さなUI部品：アイコン、ポップアップ、お知らせ、吹き出し
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = {
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
  ball: '<circle cx="12" cy="12" r="8"/><path d="M5 9c4 2 10 2 14 0M5 15c4-2 10-2 14 0"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/>',
  magic: '<path d="M4 20l4-1 9-9-3-3-9 9z"/><path d="M18 2l.8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8z"/>',
  more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  bath: '<path d="M3 13h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><circle cx="8" cy="7" r="2"/><circle cx="14" cy="5" r="1.5"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M9 9h6M9 13h6"/>',
  pot: '<path d="M3 12h13a4 4 0 0 1 0 8H7a4 4 0 0 1-4-4z"/><path d="M16 14h3a2 2 0 0 0 0-4h-3"/>',
  tray: '<path d="M3 15h18M6 15a6 6 0 0 1 12 0M12 7v2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>',
  eraser: '<path d="M7 20h12M5 15l8-8 6 6-6 6H9z"/>',
  frame: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 15l5-4 4 3 3-2 4 3"/>',
  house: '<path d="M4 11l8-6 8 6v9H4z"/><path d="M10 20v-5h4v5"/>',
  shop: '<path d="M4 9h16l-1-4H5z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cart: '<path d="M3 4h3l2 11h11l2-8H7"/><circle cx="10" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  sofa: '<path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M3 12h18v5H3zM5 17v2M19 17v2"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
};
export const icon = (n, size = 26) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

// ---- ポップアップ ----
let current = null;
export function modal(html, { onAct, wide = false, closable = true } = {}) {
  closeModal();
  const root = $('#modal-root');
  root.innerHTML = `<div class="veil"></div><section class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${closable ? `<button class="sheet-close" data-act="close" aria-label="閉じる">${icon('close', 20)}</button>` : ''}${html}</section>`;
  root.hidden = false;
  const handler = e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.act === 'close') { closeModal(); onAct?.('close', b); return; }
    onAct?.(b.dataset.act, b, e);
  };
  root.addEventListener('click', handler);
  if (closable) root.querySelector('.veil').addEventListener('click', () => { closeModal(); onAct?.('close'); });
  current = { root, handler };
  return root.querySelector('.sheet');
}
export function closeModal() {
  if (!current) return;
  current.root.removeEventListener('click', current.handler);
  current.root.innerHTML = '';
  current.root.hidden = true;
  current = null;
}
export const modalOpen = () => !!current;

// ---- お知らせ ----
let toastTimer = 0;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---- 吹き出し ----
const bubbles = {};
export function say(who, text, ms = 3200) {
  const b = $(`#bubble-${who}`);
  if (!b) return;
  b.innerHTML = text;
  b.hidden = !text;
  clearTimeout(bubbles[who]);
  if (ms && text) bubbles[who] = setTimeout(() => (b.hidden = true), ms);
}
export function placeBubbles(anchors) {
  const top = Math.max($('.hud-top')?.getBoundingClientRect().bottom || 80, $('#status')?.getBoundingClientRect().bottom || 0, $('#alert:not([hidden])')?.getBoundingClientRect().bottom || 0) + 10;
  for (const who of ['pet', 'guest']) {
    const b = $(`#bubble-${who}`), a = anchors[who];
    if (!b || b.hidden || !a) continue;
    const w = b.offsetWidth, h = b.offsetHeight, W = innerWidth;
    const x = Math.max(12 + w / 2, Math.min(W - 12 - w / 2, a.x));
    const y = Math.max(top + h, a.y - 10);
    b.style.transform = `translate(${x - w / 2}px, ${y - h}px)`;
    b.style.visibility = a.visible ? 'visible' : 'hidden';
  }
}
