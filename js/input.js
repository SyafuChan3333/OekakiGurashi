// スマホのブラウザ向けの共通の入力の仕組み（4.5）。
// 長押しメニュー・文字選択・ダブルタップ拡大・ピンチ拡大・引っぱって更新を抑える。

export function installInputGuards(root = document) {
  const allowText = t => t?.closest?.('input, textarea, [data-allow-select]');
  for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
    root.addEventListener(type, e => { if (!allowText(e.target)) e.preventDefault(); }, { capture: true });
  }
  // iOS Safari はページ拡大を viewport で止められないので、ジェスチャーを止める
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    root.addEventListener(type, e => e.preventDefault(), { passive: false });
  }
  // ダブルタップでの拡大は CSS の touch-action: manipulation で防ぐ（style.css）
  document.querySelectorAll('img').forEach(i => (i.draggable = false));
}

// ドラッグを扱う要素用。pointercancel は必ず「指を離した」と同じ扱いにする
export function onDrag(el, { start, move, end }) {
  let id = null;
  el.addEventListener('pointerdown', e => {
    if (id !== null) return;
    id = e.pointerId;
    el.setPointerCapture?.(id);
    start?.(e);
  });
  el.addEventListener('pointermove', e => { if (e.pointerId === id) move?.(e); });
  const finish = e => {
    if (e.pointerId !== id) return;
    id = null;
    end?.(e);
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
  el.addEventListener('lostpointercapture', finish);
}
