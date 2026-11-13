// ミニゲーム：お風呂（3.4 の枠で、結果 { done, quality } を返す）
// 工程：ぬらす（なぞる）→ 泡をつける（こする）→ 洗い流す（なぞる）→ ブロー（水てきをタップ）
// 長押しは使わない（4.5）。相棒の絵の上だけが判定の対象。
import { $, esc, icon } from './ui.js';
import { onDrag } from './input.js';
import { play } from './audio.js';

const SIZE = 512, GRID = 8;
const STEPS = [
  { id: 'wet', name: 'ぬらす', how: 'シャワーで、からだ全体をなぞろう', tool: 'shower' },
  { id: 'lather', name: '泡をつける', how: 'からだを、こするように泡立てよう', tool: 'sponge' },
  { id: 'rinse', name: '洗い流す', how: 'シャワーで、泡をぜんぶ流そう', tool: 'shower' },
  { id: 'blow', name: 'ブロー', how: '残った水てきを、タップで吹きとばそう', tool: 'dryer' },
];
const GOOD_TIME = 40; // 秒。これより早く終わると出来ばえ「よい」

export function bathGame({ petName, petImage }) {
  return new Promise(resolve => {
    const root = $('#editor');
    root.hidden = false;
    document.body.classList.add('editing'); // HUDを隠し、お世話の時計も止める
    root.innerHTML = `
      <div class="ed-top">
        <button class="btn" data-mg="quit">やめる</button>
        <b class="ed-title">${esc(petName)}のお風呂</b>
        <span aria-hidden="true"></span>
      </div>
      <p class="mg-how" id="mg-how"></p>
      <div class="mg-progress"><span class="mg-steps">${STEPS.map((s, i) => `<i data-i="${i}">${i + 1}</i>`).join('')}</span><div class="mg-bar"><b id="mg-bar"></b></div></div>
      <div class="ed-canvas-wrap"><canvas width="${SIZE}" height="${SIZE}" class="ed-canvas mg-canvas"></canvas></div>`;
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
    const pet = new Image();
    let box = { x: 56, y: 70, w: 400, h: 400 }, mask = [], cells = 0;
    let locked = false, step = 0, wet = new Set(), foam = [], drops = [], flying = [], falling = [], pointer = null, finished = false;
    const t0 = performance.now();

    // 相棒の絵のある場所だけを、8×8のマスで判定する
    pet.onload = () => {
      const r = Math.min(400 / pet.naturalWidth, 400 / pet.naturalHeight);
      box = { w: pet.naturalWidth * r, h: pet.naturalHeight * r };
      box.x = (SIZE - box.w) / 2; box.y = SIZE - box.h - 40;
      const off = document.createElement('canvas'); off.width = off.height = SIZE;
      const o = off.getContext('2d'); o.drawImage(pet, box.x, box.y, box.w, box.h);
      const px = o.getImageData(0, 0, SIZE, SIZE).data;
      mask = [];
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
        const x = Math.floor(box.x + (gx + 0.5) * box.w / GRID), y = Math.floor(box.y + (gy + 0.5) * box.h / GRID);
        mask.push(px[(y * SIZE + x) * 4 + 3] > 40);
      }
      cells = mask.filter(Boolean).length || 1;
      enter(0);
    };
    pet.src = petImage;

    const cellAt = (x, y) => {
      const gx = Math.floor((x - box.x) / box.w * GRID), gy = Math.floor((y - box.y) / box.h * GRID);
      if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return -1;
      const i = gy * GRID + gx;
      return mask[i] ? i : -1;
    };
    const progress = () => {
      const id = STEPS[step]?.id;
      if (id === 'wet') return wet.size / cells;
      if (id === 'lather') return new Set(foam.map(f => f.cell)).size / cells;
      if (id === 'rinse') return 1 - foam.length / Math.max(1, foamTotal);
      if (id === 'blow') return 1 - drops.length / dropTotal;
      return 1;
    };
    let foamTotal = 1, dropTotal = 1;

    function enter(i) {
      step = i;
      root.querySelectorAll('.mg-steps i').forEach((el, n) => { el.classList.toggle('on', n === i); el.classList.toggle('done', n < i); });
      if (i >= STEPS.length) return finish();
      $('#mg-how').textContent = `${STEPS[i].name}：${STEPS[i].how}`;
      if (STEPS[i].id === 'rinse') foamTotal = foam.length;
      if (STEPS[i].id === 'blow') {
        drops = Array.from({ length: 10 }, () => {
          let x, y, tries = 0;
          do { x = box.x + Math.random() * box.w; y = box.y + Math.random() * box.h; } while (cellAt(x, y) < 0 && ++tries < 40);
          return { x, y, r: 14 + Math.random() * 7 };
        });
        dropTotal = drops.length;
      }
    }
    function advanceIfDone() {
      const p = Math.min(1, progress());
      $('#mg-bar').style.width = `${Math.round(p * 100)}%`;
      const need = { wet: 0.8, lather: 0.75, rinse: 0.95, blow: 1 }[STEPS[step].id];
      if (p >= need) {
        play('happy');
        if (STEPS[step].id === 'rinse') foam = [];
        if (STEPS[step].id === 'wet') wet = new Set(mask.map((m, i) => (m ? i : -1)).filter(i => i >= 0));
        // 工程が変わったら、指を一度離して触り直すまで判定しない
        locked = true;
        last = null;
        enter(step + 1);
        if (step < STEPS.length) $('#mg-bar').style.width = '0%';
      }
    }

    // ---- 操作 ----
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height }; };
    let last = null, rubDir = 0, rubX = 0;
    onDrag(cv, {
      start: e => {
        if (finished) return;
        locked = false;
        last = pointer = pos(e);
        if (STEPS[step]?.id === 'blow') tapDrop(pointer);
      },
      move: e => {
        if (finished || locked || !last) return;
        const p = pointer = pos(e), id = STEPS[step]?.id;
        const dist = Math.hypot(p.x - last.x, p.y - last.y);
        if (dist < 4) return;
        if (id === 'wet' || id === 'rinse') {
          for (let k = 0; k < 2; k++) falling.push({ x: p.x + (Math.random() - 0.5) * 50, y: p.y + 20, v: 4 + Math.random() * 3, life: 1 });
          if (id === 'wet') { const c = cellAt(p.x, p.y); if (c >= 0) wet.add(c); for (const [dx, dy] of [[-30, 10], [30, 10], [0, 40]]) { const c2 = cellAt(p.x + dx, p.y + dy); if (c2 >= 0) wet.add(c2); } }
          if (id === 'rinse') foam = foam.filter(f => Math.hypot(f.x - p.x, f.y - (p.y + 30)) > 48);
        }
        if (id === 'lather') {
          // こする：左右に往復すると泡が増える
          const d = Math.sign(p.x - rubX);
          if (d && d !== rubDir) { rubDir = d; }
          rubX = p.x;
          const c = cellAt(p.x, p.y);
          if (c >= 0 && foam.filter(f => f.cell === c).length < 4) foam.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30, r: 10 + Math.random() * 14, cell: c });
        }
        last = p;
        advanceIfDone();
      },
      end: () => { last = null; },
    });
    function tapDrop(p) {
      if (locked) return;
      const i = drops.findIndex(d => Math.hypot(d.x - p.x, d.y - p.y) < d.r + 22);
      if (i < 0) return;
      const [d] = drops.splice(i, 1);
      flying.push({ ...d, vx: (d.x > SIZE / 2 ? 1 : -1) * (6 + Math.random() * 4), vy: -5, life: 1 });
      play('tap');
      advanceIfDone();
    }

    // ---- 描画 ----
    let raf = 0;
    const tub = () => {
      ctx.fillStyle = '#dbeef3'; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.strokeStyle = '#c4e0e8'; ctx.lineWidth = 2;
      for (let x = 0; x <= SIZE; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIZE); ctx.stroke(); }
      for (let y = 0; y <= SIZE; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke(); }
      ctx.fillStyle = '#fbf8f2'; ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(SIZE / 2, SIZE - 30, 220, 46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };
    const tool = () => {
      if (!pointer || finished) return;
      const t = STEPS[step]?.tool, { x, y } = pointer;
      ctx.save(); ctx.translate(x, y - 40); ctx.lineWidth = 4; ctx.strokeStyle = '#3a302a';
      if (t === 'shower') { ctx.fillStyle = '#c9d6dc'; ctx.beginPath(); ctx.ellipse(0, 0, 28, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(44, -34); ctx.stroke(); }
      if (t === 'sponge') { ctx.fillStyle = '#f1c45a'; ctx.beginPath(); ctx.roundRect(-26, -16, 52, 32, 10); ctx.fill(); ctx.stroke(); }
      if (t === 'dryer') { ctx.fillStyle = '#e9a985'; ctx.beginPath(); ctx.roundRect(-30, -16, 46, 32, 12); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(4, 14); ctx.lineTo(10, 40); ctx.stroke(); }
      ctx.restore();
    };
    function frame() {
      tub();
      if (pet.complete && pet.naturalWidth) {
        ctx.drawImage(pet, box.x, box.y, box.w, box.h);
        // ぬれたところは少し青く
        ctx.fillStyle = 'rgba(95, 160, 205, 0.14)';
        for (const i of wet) {
          if (STEPS[step]?.id === 'blow' || step >= STEPS.length) break;
          const gx = i % GRID, gy = Math.floor(i / GRID);
          ctx.beginPath(); ctx.arc(box.x + (gx + 0.5) * box.w / GRID, box.y + (gy + 0.5) * box.h / GRID, box.w / GRID * 0.62, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const f of foam) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#b9cfd8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // 水玉：上だけとがった涙の形。左上に光、右下に映りこみ、ふちは少し濃い水色
      const dropShape = d => {
        const { x, y, r } = d;
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
        g.addColorStop(0, 'rgba(240,250,255,0.95)'); g.addColorStop(0.55, 'rgba(160,210,232,0.8)'); g.addColorStop(1, 'rgba(84,152,196,0.92)');
        ctx.fillStyle = g; ctx.strokeStyle = 'rgba(58,48,42,0.6)'; ctx.lineWidth = 2;
        // 先っぽ → 右の肩 → 下半分の半円 → 左の肩 → 先っぽ
        ctx.beginPath(); ctx.moveTo(x, y - r * 1.75);
        ctx.bezierCurveTo(x + r * 0.25, y - r * 1.2, x + r, y - r * 0.6, x + r, y);
        ctx.arc(x, y, r, 0, Math.PI);
        ctx.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.25, y - r * 1.2, x, y - r * 1.75);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 0.3, r * 0.17, r * 0.32, 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0.25, 1.25); ctx.stroke(); ctx.lineCap = 'butt';
      };
      for (const d of drops) dropShape(d);
      flying = flying.filter(d => (d.life -= 0.04) > 0);
      for (const d of flying) { d.x += d.vx; d.y += d.vy; d.vy += 0.3; ctx.globalAlpha = d.life; dropShape(d); ctx.globalAlpha = 1; }
      falling = falling.filter(d => (d.life -= 0.05) > 0);
      ctx.fillStyle = '#5fa0cd';
      for (const d of falling) { d.y += d.v * 3; ctx.globalAlpha = d.life; ctx.fillRect(d.x, d.y, 3, 10); ctx.globalAlpha = 1; }
      if (step >= STEPS.length) sparkle();
      tool();
      raf = requestAnimationFrame(frame);
    }
    frame();

    // できあがりのきらきら：大きめの星が、ゆっくり回りながら落ちて、消えていく
    let sparks = [], nextSpark = 0;
    const star = (x, y, r, rot) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
      for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.38 : r, a = (Math.PI / 4) * k; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    };
    function sparkle() {
      const now = performance.now();
      if (now > nextSpark && sparks.length < 26) {
        sparks.push({ x: box.x + Math.random() * box.w, y: box.y - 10 + Math.random() * box.h * 0.4, r: 12 + Math.random() * 12, vy: 0.35 + Math.random() * 0.45, vx: (Math.random() - 0.5) * 0.3, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.02, life: 1, color: Math.random() < 0.65 ? '#f5d77a' : '#ffffff' });
        nextSpark = now + 140;
      }
      sparks = sparks.filter(p => (p.life -= 0.006) > 0);
      for (const p of sparks) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.globalAlpha = Math.min(1, p.life * 1.6);
        ctx.fillStyle = p.color; ctx.strokeStyle = '#e3a43c';
        star(p.x, p.y, p.r * (0.7 + 0.3 * p.life), p.rot);
        ctx.globalAlpha = 1;
      }
    }

    function finish() {
      finished = true;
      const sec = (performance.now() - t0) / 1000, quality = sec <= GOOD_TIME ? 'good' : 'normal';
      play('done');
      $('#mg-how').textContent = quality === 'good' ? 'ぴかぴか！ 手ぎわよく洗えました' : 'ぴかぴか！ さっぱりしました';
      $('#mg-bar').style.width = '100%';
      const ok = document.createElement('button');
      ok.className = 'btn primary wide mg-ok';
      ok.textContent = 'お風呂おしまい';
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
