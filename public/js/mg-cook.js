// ミニゲーム：料理を作る（3.4 の枠で、結果 { done, quality } を返す）
// 作り方は料理の種類で自動的に決まる。自作の料理にも材料の設定はいらない。
//   飲みもの → 注ぐ（ドラッグで傾けて、線のところで止める）
//   ごはんもの → 焼く（動く目もりを、ちょうどいいところでタップ）×3
//   しょっぱいもの → 切る（点線に沿ってスワイプ）×3
//   甘いもの → 飾る（料理の上をタップしてトッピングを置く）×6
// 料理の絵は、進み具合に合わせて少しずつ現れる（飾るだけは、はじめからはっきり見せる）。長押しは使わない（4.5）。
import { $, esc } from './ui.js';
import { onDrag } from './input.js';
import { play } from './audio.js';

const SIZE = 512;
const KINDS = {
  drink: { verb: '注ぐ', how: 'ポットを右へドラッグして傾けよう。線のあいだで指を離すとぴったり' },
  meal: { verb: '焼く', how: '動く目もりが、まんなかに来たらタップ（3回）' },
  salty: { verb: '切る', how: '点線に沿って、左から右へスワイプ（3本）' },
  sweet: { verb: '飾る', how: '料理の上をタップして、トッピングをのせよう（6こ）' },
};
const LABEL = { good: 'じょうずにできた！', normal: 'できた！', poor: 'ちょっと失敗…でも、できた' };

export function cookGame({ dish }) {
  const kind = KINDS[dish.cat] ? dish.cat : 'meal';
  return new Promise(resolve => {
    const root = $('#editor');
    root.hidden = false;
    document.body.classList.add('editing');
    root.innerHTML = `
      <div class="ed-top">
        <button class="btn" data-mg="quit">やめる</button>
        <b class="ed-title"><span class="nb">${esc(dish.name)}を</span><span class="nb">${KINDS[kind].verb}</span></b>
        <span aria-hidden="true"></span>
      </div>
      <p class="mg-how" id="mg-how">${esc(KINDS[kind].how)}</p>
      <div class="mg-progress"><span class="mg-count" id="mg-count"></span><div class="mg-bar"><b id="mg-bar"></b></div></div>
      <div class="ed-canvas-wrap"><canvas width="${SIZE}" height="${SIZE}" class="ed-canvas mg-canvas cook"></canvas></div>`;
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
    const img = new Image();
    img.src = dish.image;
    let reveal = 0, done = false, raf = 0, locked = false;
    const setBar = v => { $('#mg-bar').style.width = `${Math.round(Math.min(1, v) * 100)}%`; };
    const setCount = t => { $('#mg-count').textContent = t; };

    // ---- 料理の絵（上半分）。reveal に合わせて現れる ----
    const DISH = { x: 156, y: 18, w: 200, h: 200 };
    function drawDish(mode = 'fade') {
      if (!img.complete || !img.naturalWidth) return;
      const r = Math.min(DISH.w / img.naturalWidth, DISH.h / img.naturalHeight), w = img.naturalWidth * r, h = img.naturalHeight * r;
      const x = DISH.x + (DISH.w - w) / 2, y = DISH.y + (DISH.h - h) / 2;
      if (mode === 'full') { ctx.drawImage(img, x, y, w, h); return; } // 飾るは、はじめから料理がはっきり見える
      ctx.globalAlpha = 0.12; ctx.drawImage(img, x, y, w, h); ctx.globalAlpha = 1; // うっすら下絵
      if (mode === 'fill') { // 下から満ちていく
        const ch = h * reveal;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y + h - ch, w, ch); ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore();
      } else { ctx.globalAlpha = reveal; ctx.drawImage(img, x, y, w, h); ctx.globalAlpha = 1; }
    }
    const bg = () => {
      ctx.fillStyle = '#fbf3e4'; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#efe2c9'; ctx.fillRect(0, 236, SIZE, SIZE - 236);
      ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 236); ctx.lineTo(SIZE, 236); ctx.stroke();
    };
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height }; };

    // ---- 種類ごとの遊び ----
    const games = {
      // 注ぐ
      drink() {
        let level = 0, tilt = 0, startX = 0, pouring = false, poured = false, spilled = false;
        const CUP = { x: 196, y: 300, w: 120, h: 170 }, LOW = 0.7, HIGH = 0.88;
        onDrag(cv, {
          start: e => { if (done) return; startX = pos(e).x; pouring = true; },
          move: e => { if (!pouring) return; tilt = Math.max(0, Math.min(1, (pos(e).x - startX) / 140)); },
          end: () => {
            if (!pouring) return;
            pouring = false; tilt = 0;
            if (poured) judge();
          },
        });
        function judge() {
          const q = spilled || level > 1 ? 'poor' : level >= LOW && level <= HIGH ? 'good' : level >= 0.5 ? 'normal' : null;
          if (!q) { $('#mg-how').textContent = 'まだ少ないみたい。もう少し注ごう'; return; }
          finish(q);
        }
        return dt => {
          if (pouring && tilt > 0.15 && !done) { level += tilt * dt * 0.45; poured = true; if (level > 1.02) { spilled = true; level = 1.02; } }
          if (!done) { reveal = Math.min(1, level / 0.8); setBar(level); }
          drawDish('fill');
          // カップと目じるし
          ctx.lineWidth = 4; ctx.strokeStyle = '#3a302a'; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.roundRect(CUP.x, CUP.y, CUP.w, CUP.h, [0, 0, 18, 18]); ctx.fill(); ctx.stroke();
          const lv = Math.min(1, level), fillH = CUP.h * lv;
          ctx.fillStyle = spilled ? '#c99a7a' : '#d9a066'; ctx.fillRect(CUP.x + 3, CUP.y + CUP.h - fillH, CUP.w - 6, fillH - 3);
          ctx.fillStyle = 'rgba(127, 174, 106, 0.35)'; ctx.fillRect(CUP.x - 14, CUP.y + CUP.h * (1 - HIGH), CUP.w + 28, CUP.h * (HIGH - LOW));
          ctx.strokeStyle = '#5f8a52'; ctx.setLineDash([8, 6]);
          for (const v of [LOW, HIGH]) { ctx.beginPath(); ctx.moveTo(CUP.x - 14, CUP.y + CUP.h * (1 - v)); ctx.lineTo(CUP.x + CUP.w + 14, CUP.y + CUP.h * (1 - v)); ctx.stroke(); }
          ctx.setLineDash([]);
          // ポット（傾く）
          ctx.save(); ctx.translate(360, 280); ctx.rotate(-0.15 - tilt * 1.0);
          ctx.fillStyle = '#e9a985'; ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.roundRect(-10, -20, 80, 70, 14); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-44, -18); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
          if (pouring && tilt > 0.15 && !done) { ctx.fillStyle = '#d9a066'; ctx.fillRect(CUP.x + CUP.w / 2 + 6, 290, 8 * tilt + 3, CUP.y + CUP.h - fillH - 290); }
          if (spilled) { ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.ellipse(CUP.x + CUP.w / 2, CUP.y + CUP.h + 8, 90, 10, 0, 0, Math.PI * 2); ctx.fill(); }
        };
      },
      // 焼く
      meal() {
        let round = 0, t = 0, hits = [], flash = 0, msg = '';
        const ROUNDS = 3, BAR = { x: 56, y: 420, w: 400, h: 34 };
        const marker = () => (Math.sin(t * (2.2 + round * 0.6)) + 1) / 2; // 0〜1を往復
        onDrag(cv, {
          start: () => {
            if (done || locked) return;
            const m = marker(), d = Math.abs(m - 0.5);
            const r = d < 0.08 ? 'good' : d < 0.22 ? 'normal' : 'poor';
            hits.push(r); msg = { good: 'ちょうどいい！', normal: 'まあまあ', poor: '焼きすぎ…' }[r]; flash = 1;
            play(r === 'poor' ? 'tap' : 'happy');
            round++; reveal = round / ROUNDS; setBar(reveal); setCount(`${round}/${ROUNDS}`);
            if (round >= ROUNDS) {
              const good = hits.filter(x => x === 'good').length, poor = hits.filter(x => x === 'poor').length;
              finish(good >= 2 ? 'good' : poor >= 2 ? 'poor' : 'normal');
            }
          },
        });
        setCount(`0/${ROUNDS}`);
        return dt => {
          if (!done) t += dt;
          drawDish('fade');
          // フライパン
          ctx.fillStyle = '#5b4a3e'; ctx.beginPath(); ctx.ellipse(256, 330, 130, 50, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(380, 322, 110, 16);
          ctx.fillStyle = '#7a6656'; ctx.beginPath(); ctx.ellipse(256, 326, 112, 40, 0, 0, Math.PI * 2); ctx.fill();
          // 目もり
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.roundRect(BAR.x, BAR.y, BAR.w, BAR.h, 10); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#f1d99a'; ctx.fillRect(BAR.x + BAR.w * 0.28, BAR.y + 3, BAR.w * 0.44, BAR.h - 6);
          ctx.fillStyle = '#a6d08f'; ctx.fillRect(BAR.x + BAR.w * 0.42, BAR.y + 3, BAR.w * 0.16, BAR.h - 6);
          const mx = BAR.x + BAR.w * marker();
          ctx.fillStyle = '#e2603f'; ctx.beginPath(); ctx.moveTo(mx, BAR.y - 4); ctx.lineTo(mx - 12, BAR.y - 22); ctx.lineTo(mx + 12, BAR.y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillRect(mx - 2, BAR.y, 4, BAR.h);
          if (flash > 0) { flash -= dt; ctx.globalAlpha = Math.max(0, flash); ctx.fillStyle = '#3a302a'; ctx.font = '28px "Yusei Magic", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, 256, 290); ctx.globalAlpha = 1; }
        };
      },
      // 切る
      salty() {
        let cut = 0, path = [], scores = [], msg = '', flash = 0;
        const LINES = [[90, 300, 420, 330], [90, 360, 420, 350], [90, 430, 420, 400]];
        const yAt = (l, x) => l[1] + (l[3] - l[1]) * (x - l[0]) / (l[2] - l[0]);
        onDrag(cv, {
          start: e => { if (done) return; locked = false; path = [pos(e)]; },
          move: e => { if (done || locked || !path.length) return; path.push(pos(e)); },
          end: () => {
            if (done || locked || path.length < 2) { path = []; return; }
            const l = LINES[cut], xs = path.map(p => p.x), span = (Math.min(Math.max(...xs), l[2]) - Math.max(Math.min(...xs), l[0])) / (l[2] - l[0]);
            if (span < 0.6) { msg = 'もっと長く、端から端まで'; flash = 1.2; path = []; return; }
            const dev = path.filter(p => p.x >= l[0] && p.x <= l[2]).reduce((s, p) => s + Math.abs(p.y - yAt(l, p.x)), 0) / Math.max(1, path.length);
            const r = dev < 14 ? 'good' : dev < 32 ? 'normal' : 'poor';
            scores.push(r); msg = { good: 'まっすぐ！', normal: 'すこしずれた', poor: 'がたがた…' }[r]; flash = 1;
            play(r === 'poor' ? 'tap' : 'happy');
            cut++; reveal = cut / LINES.length; setBar(reveal); setCount(`${cut}/${LINES.length}`);
            path = []; locked = true;
            if (cut >= LINES.length) {
              const good = scores.filter(x => x === 'good').length, poor = scores.filter(x => x === 'poor').length;
              finish(good >= 2 ? 'good' : poor >= 2 ? 'poor' : 'normal');
            }
          },
        });
        setCount(`0/${LINES.length}`);
        return dt => {
          drawDish('fade');
          // まな板
          ctx.fillStyle = '#e6c79a'; ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.roundRect(60, 262, 392, 210, 18); ctx.fill(); ctx.stroke();
          LINES.forEach((l, i) => {
            ctx.lineWidth = i === cut ? 4 : 2; ctx.strokeStyle = i < cut ? '#a58a6a' : i === cut ? '#e2603f' : '#c7a77c';
            ctx.setLineDash(i < cut ? [] : [10, 8]); ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
          });
          ctx.setLineDash([]);
          if (path.length > 1) { ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 3; ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
          if (flash > 0) { flash -= dt; ctx.globalAlpha = Math.max(0, Math.min(1, flash)); ctx.fillStyle = '#3a302a'; ctx.font = '26px "Yusei Magic", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, 256, 254 + 0); ctx.globalAlpha = 1; }
        };
      },
      // 飾る
      sweet() {
        const NEED = 6, items = [];
        const TOPS = [
          (x, y) => { ctx.fillStyle = '#e2603f'; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7fae6a'; ctx.fillRect(x - 4, y - 18, 8, 6); },
          (x, y) => { ctx.fillStyle = '#ffffff'; for (const [dx, dy, r] of [[0, 4, 14], [0, -6, 10], [0, -14, 6]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } },
          (x, y) => { ctx.fillStyle = '#7a4a2e'; ctx.beginPath(); ctx.roundRect(x - 10, y - 6, 20, 12, 4); ctx.fill(); ctx.stroke(); },
        ];
        // 飾る遊びは料理の上で行うので、料理を大きく真ん中に出す
        DISH.x = 106; DISH.y = 60; DISH.w = 300; DISH.h = 300;
        onDrag(cv, {
          start: e => {
            if (done) return;
            const p = pos(e);
            if (p.x < DISH.x || p.x > DISH.x + DISH.w || p.y < DISH.y || p.y > DISH.y + DISH.h) return;
            items.push({ ...p, k: items.length % TOPS.length });
            play('tap');
            reveal = items.length / NEED; setBar(reveal); setCount(`${items.length}/${NEED}`);
            if (items.length >= NEED) finish('good');
          },
        });
        setCount(`0/${NEED}`);
        return () => {
          ctx.fillStyle = '#fbf3e4'; ctx.fillRect(0, 0, SIZE, SIZE);
          drawDish('full');
          ctx.lineWidth = 2.5; ctx.strokeStyle = '#3a302a';
          for (const it of items) TOPS[it.k](it.x, it.y);
          if (!done) { ctx.globalAlpha = 0.6; TOPS[items.length % TOPS.length](460, 470); ctx.globalAlpha = 1; ctx.fillStyle = '#5a4f44'; ctx.font = '18px "Yusei Magic", sans-serif'; ctx.textAlign = 'right'; ctx.fillText('つぎ →', 440, 476); }
        };
      },
    };

    const step = games[kind]();
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (kind !== 'sweet') bg();
      step(dt);
      if (done) { reveal = Math.min(1, reveal + dt * 1.5); }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function finish(quality) {
      if (done) return;
      done = true;
      play('done');
      setBar(1);
      $('#mg-how').textContent = LABEL[quality];
      const ok = document.createElement('button');
      ok.className = 'btn primary wide mg-ok';
      ok.textContent = 'できあがり';
      ok.onclick = () => close({ done: true, quality });
      root.appendChild(ok);
    }
    function close(result) {
      cancelAnimationFrame(raf);
      root.hidden = true; root.innerHTML = ''; root.onclick = null;
      document.body.classList.remove('editing');
      resolve(result);
    }
    root.onclick = e => { if (e.target.closest('[data-mg="quit"]')) close({ done: false }); };
  });
}
