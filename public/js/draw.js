// 「描く」：自分で描く／魔法のペンにおまかせ（2章）
// エディタはわざと簡素にしている（ペン・消しゴム・色・太さ・戻す）。
import { modal, closeModal, icon, esc, $ } from './ui.js';
import { onDrag } from './input.js';
import { play } from './audio.js';

const COLORS = ['#3a302a', '#ffffff', '#e2603f', '#f1c45a', '#7fae6a', '#5f8fc4', '#c48ab8', '#a7795a'];
const SIZES = [4, 10, 22];

// 2択のポップアップ → 結果 { image, self } または null
export function drawFlow({ title, gallery = [], base = null, note = '' }) {
  return new Promise(resolve => {
    const done = v => { closeModal(); resolve(v); };
    const choose = () => {
      modal(`
        <h2>${esc(title)}</h2>
        ${note ? `<p class="note">${esc(note)}</p>` : ''}
        <div class="two-choice">
          <button class="choice dark" data-act="self">${icon('pen', 44)}<b>自分で描く</b><small>描いたものには、いいことがあります</small></button>
          ${gallery.length ? `<button class="choice" data-act="pen">${icon('magic', 44)}<b>魔法のペンにおまかせ</b><small>あとから描き直せます</small></button>` : ''}
        </div>`, {
        onAct: async act => {
          if (act === 'close') return resolve(null);
          if (act === 'self') { closeModal(); const img = await openEditor({ title, base }); resolve(img ? { image: img, self: true } : null); }
          if (act === 'pen') pickPen();
        },
      });
    };
    const pickPen = () => {
      modal(`
        <h2>どれを描いてもらう？</h2>
        <div class="pen-grid">${gallery.map((g, i) => `<button class="pen-item" data-act="pick" data-i="${i}"><img src="${g.src}" alt="" draggable="false"><span>${esc(g.name)}</span></button>`).join('')}</div>
        <button class="btn" data-act="back">もどる</button>`, {
        wide: true,
        onAct: (act, el) => {
          if (act === 'close') return resolve(null);
          if (act === 'back') return choose();
          if (act === 'pick') magic(gallery[+el.dataset.i]);
        },
      });
    };
    const magic = g => {
      modal(`
        <h2>${esc(g.name)}</h2>
        <div class="paper"><div class="shaka">${icon('magic', 80)}</div><span class="paper-note">シャカシャカ…</span></div>`, { closable: false });
      play('tap');
      setTimeout(() => {
        play('done');
        modal(`
          <h2>${esc(g.name)}</h2>
          <div class="paper"><img class="fadein" src="${g.src}" alt="" draggable="false"></div>
          <div class="row-end">
            <button class="btn" data-act="redraw">自分で描き直す</button>
            <button class="btn primary" data-act="ok">これにする</button>
          </div>`, {
          onAct: async act => {
            if (act === 'close') return resolve(null);
            if (act === 'ok') done({ image: g.src, self: false, name: g.name, pen: g });
            if (act === 'redraw') { closeModal(); const img = await openEditor({ title, base: g.src }); resolve(img ? { image: img, self: true } : null); }
          },
        });
      }, 1300);
    };
    choose();
  });
}

// 全画面のお絵かき（HUDは隠す）。base があればそれを下に敷いて描き足す
export function openEditor({ title, base = null }) {
  return new Promise(resolve => {
    const root = $('#editor');
    root.hidden = false;
    document.body.classList.add('editing');
    root.innerHTML = `
      <div class="ed-top">
        <button class="btn" data-ed="cancel">やめる</button>
        <b class="ed-title">${esc(title)}</b>
        <button class="btn primary" data-ed="ok">できた</button>
      </div>
      <div class="ed-canvas-wrap"><canvas width="512" height="512" class="ed-canvas"></canvas></div>
      <div class="ed-tools">
        <div class="ed-colors">${COLORS.map((c, i) => `<button class="swatch ${i === 0 ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="色 ${i + 1}"></button>`).join('')}</div>
        <div class="ed-row">
          ${SIZES.map((s, i) => `<button class="size ${i === 1 ? 'on' : ''}" data-size="${s}" aria-label="太さ ${i + 1}"><i style="width:${s / 1.4 + 4}px;height:${s / 1.4 + 4}px"></i></button>`).join('')}
          <button class="tool" data-ed="eraser" aria-label="消しゴム">${icon('eraser', 24)}</button>
          <button class="tool" data-ed="undo" aria-label="ひとつ戻す">${icon('undo', 24)}</button>
          <button class="tool" data-ed="clear">${base ? '元に戻す' : '全部消す'}</button>
        </div>
      </div>`;
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
    let color = COLORS[0], size = SIZES[1], erase = false, history = [], baseImg = null;
    const snapshot = () => { history.push(ctx.getImageData(0, 0, 512, 512)); if (history.length > 25) history.shift(); };
    const reset = () => {
      ctx.clearRect(0, 0, 512, 512);
      if (baseImg) {
        const r = Math.min(480 / baseImg.naturalWidth, 480 / baseImg.naturalHeight);
        const w = baseImg.naturalWidth * r, h = baseImg.naturalHeight * r;
        ctx.drawImage(baseImg, (512 - w) / 2, 512 - h - 8, w, h);
      }
    };
    if (base) { baseImg = new Image(); baseImg.onload = reset; baseImg.src = base; }

    let last = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 512 / r.width, (e.clientY - r.top) * 512 / r.height]; };
    const dot = ([x, y], [px, py]) => {
      ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color; ctx.lineWidth = size * (erase ? 1.6 : 1); ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
    };
    onDrag(cv, {
      start: e => { snapshot(); last = pos(e); dot(last, last); },
      move: e => { if (!last) return; const p = pos(e); dot(p, last); last = p; },
      end: () => { last = null; },
    });
    const finish = v => {
      root.hidden = true; root.innerHTML = '';
      document.body.classList.remove('editing');
      resolve(v);
    };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.color) { color = b.dataset.color; erase = false; root.querySelectorAll('.swatch,.tool').forEach(x => x.classList.toggle('on', x === b)); }
      if (b.dataset.size) { size = +b.dataset.size; root.querySelectorAll('.size').forEach(x => x.classList.toggle('on', x === b)); }
      const a = b.dataset.ed;
      if (a === 'eraser') { erase = true; root.querySelectorAll('.swatch,.tool').forEach(x => x.classList.toggle('on', x === b)); }
      if (a === 'undo' && history.length) ctx.putImageData(history.pop(), 0, 0);
      if (a === 'clear') { snapshot(); reset(); }
      if (a === 'cancel') finish(null);
      if (a === 'ok') {
        const px = ctx.getImageData(0, 0, 512, 512).data;
        let any = false; for (let i = 3; i < px.length; i += 16) if (px[i] > 10) { any = true; break; }
        if (!any) { b.textContent = '何か描いてね'; setTimeout(() => (b.textContent = 'できた'), 1400); return; }
        finish(cv.toDataURL('image/png'));
      }
    };
  });
}
