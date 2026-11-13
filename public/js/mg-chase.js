// ミニゲーム：迎えに行く（ハラハラモードで相棒が外へ出てしまったとき。3.4 の枠で { done, quality } を返す）
// かくれんぼ：庭のどこかに相棒がかくれている。ときどき耳がのぞいたり、かくれ場所がゆれたりする。
// 見つけたら別の場所へ逃げるので、3回見つけると帰ってくる。外れても失敗にはならない。
// 長押し・ダブルタップは使わない（4.5）。
import { $, esc } from './ui.js';
import { onDrag } from './input.js';
import { play } from './audio.js';

const SIZE = 512, NEED = 3, PET_H = 120;
// かくれ場所。x は中央、bottom は足もと。奥の列を先に描く
const SPOTS = [
  { kind: 'bush', x: 110, bottom: 330, w: 130, h: 104, color: '#9cc58a' },
  { kind: 'pot', x: 256, bottom: 330, w: 104, h: 100 },
  { kind: 'barrel', x: 404, bottom: 330, w: 104, h: 108 },
  { kind: 'box', x: 170, bottom: 468, w: 132, h: 104 },
  { kind: 'bush', x: 360, bottom: 468, w: 140, h: 108, color: '#b4cf86' },
];

export function chaseGame({ petName, petImage }) {
  return new Promise(resolve => {
    const root = $('#editor');
    root.hidden = false;
    document.body.classList.add('editing');
    root.innerHTML = `
      <div class="ed-top">
        <button class="btn" data-mg="quit">やめる</button>
        <b class="ed-title"><span class="nb">${esc(petName)}を</span><span class="nb">迎えに行く</span></b>
        <span aria-hidden="true"></span>
      </div>
      <p class="mg-how" id="mg-how">かくれている場所をタップして、見つけよう</p>
      <div class="mg-progress"><span class="mg-count" id="mg-count">0/${NEED}</span><div class="mg-bar"><b id="mg-bar"></b></div></div>
      <div class="ed-canvas-wrap"><canvas width="${SIZE}" height="${SIZE}" class="ed-canvas mg-canvas chase"></canvas></div>`;
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
    const pet = new Image(); pet.src = petImage;
    const how = t => { $('#mg-how').textContent = t; };
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height }; };

    let at = -1, found = 0, misses = 0, done = false, raf = 0;
    let state = 'hide', stateAt = performance.now(); // hide（かくれている）→ pop（見つかって顔を出す）→ hide …… → home（帰ってくる）
    const shake = SPOTS.map(() => 0); // タップしたときや、中でもぞもぞしたときのゆれ
    let pops = [], nextHint = performance.now() + 1600, hintAt = -1e9; // hintAt：もぞもぞした時刻
    const pop = (text, x, y, color = '#e0794f') => pops.push({ text, x, y, life: 1, color });
    const hideAgain = () => {
      let n; do n = Math.floor(Math.random() * SPOTS.length); while (n === at);
      at = n; state = 'hide'; stateAt = performance.now(); nextHint = stateAt + 1400 + Math.random() * 800; hintAt = -1e9;
    };
    hideAgain();

    onDrag(cv, {
      start: e => {
        if (done || state !== 'hide') return;
        const p = pos(e);
        const i = SPOTS.findIndex(s => Math.abs(p.x - s.x) < s.w / 2 + 6 && p.y < s.bottom + 6 && p.y > s.bottom - s.h - 50);
        if (i < 0) return;
        shake[i] = 1;
        if (i !== at) { misses++; play('tap'); pop('いない…', SPOTS[i].x, SPOTS[i].bottom - SPOTS[i].h - 20, '#6a8fb0'); return; }
        found++; play('happy'); pop('いた！', SPOTS[i].x, SPOTS[i].bottom - SPOTS[i].h - 70);
        $('#mg-count').textContent = `${found}/${NEED}`; $('#mg-bar').style.width = `${Math.round(found / NEED * 100)}%`;
        state = found >= NEED ? 'home' : 'pop'; stateAt = performance.now();
        if (state === 'home') { how('つかまえた！ いっしょに帰ろう'); play('meow'); }
        else how(found === 1 ? 'あっ、また逃げた！ もう一回さがそう' : 'あと1回！ よく見て');
      },
      move: () => {}, end: () => {},
    });

    // ---- 描画 ----
    const ink = '#3a302a';
    const garden = () => {
      ctx.fillStyle = '#e3f0f4'; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#cfe3b5'; ctx.fillRect(0, 250, SIZE, SIZE);
      ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 250); ctx.lineTo(SIZE, 250); ctx.stroke();
      // 奥のさく
      ctx.fillStyle = '#f4ead8'; ctx.lineWidth = 2.5;
      for (let x = 8; x < SIZE; x += 40) { ctx.beginPath(); ctx.moveTo(x, 250); ctx.lineTo(x, 196); ctx.lineTo(x + 12, 184); ctx.lineTo(x + 24, 196); ctx.lineTo(x + 24, 250); ctx.fill(); ctx.stroke(); }
    };
    const blob = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
    function drawSpot(s, dx) {
      const x = s.x + dx, b = s.bottom, w = s.w, h = s.h, top = b - h;
      ctx.strokeStyle = ink; ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(58,48,42,.14)'; ctx.beginPath(); ctx.ellipse(x, b, w * 0.55, 10, 0, 0, Math.PI * 2); ctx.fill();
      if (s.kind === 'bush') {
        ctx.fillStyle = s.color;
        blob(x - w * 0.28, b - h * 0.36, h * 0.38); blob(x + w * 0.28, b - h * 0.36, h * 0.38); blob(x, b - h * 0.55, h * 0.45);
        ctx.fillRect(x - w * 0.42, b - h * 0.4, w * 0.84, h * 0.4); // 下の重なりの線を消す
        ctx.beginPath(); ctx.moveTo(x - w * 0.5, b); ctx.lineTo(x + w * 0.5, b); ctx.stroke();
      }
      if (s.kind === 'box') {
        ctx.fillStyle = '#d9b07c'; ctx.fillRect(x - w / 2, top + 14, w, h - 14); ctx.strokeRect(x - w / 2, top + 14, w, h - 14);
        ctx.fillStyle = '#e6c08e';
        ctx.beginPath(); ctx.moveTo(x - w / 2, top + 14); ctx.lineTo(x - w / 2 - 14, top - 6); ctx.lineTo(x - 6, top - 2); ctx.lineTo(x, top + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w / 2, top + 14); ctx.lineTo(x + w / 2 + 14, top - 6); ctx.lineTo(x + 6, top - 2); ctx.lineTo(x, top + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (s.kind === 'pot') {
        ctx.fillStyle = '#7fae6e'; blob(x - 20, top + 6, 20); blob(x + 22, top + 2, 22); blob(x, top - 8, 22);
        ctx.fillStyle = '#d98a62';
        ctx.beginPath(); ctx.moveTo(x - w / 2, top + 20); ctx.lineTo(x + w / 2, top + 20); ctx.lineTo(x + w * 0.36, b); ctx.lineTo(x - w * 0.36, b); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(x - w / 2 - 4, top + 14, w + 8, 18); ctx.strokeRect(x - w / 2 - 4, top + 14, w + 8, 18);
      }
      if (s.kind === 'barrel') {
        ctx.fillStyle = '#b98a5e';
        ctx.beginPath(); ctx.moveTo(x - w * 0.42, top + 8); ctx.quadraticCurveTo(x - w * 0.56, b - h / 2, x - w * 0.42, b); ctx.lineTo(x + w * 0.42, b); ctx.quadraticCurveTo(x + w * 0.56, b - h / 2, x + w * 0.42, top + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8f6a48'; ctx.beginPath(); ctx.ellipse(x, top + 8, w * 0.42, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (const t of [0.3, 0.75]) { ctx.beginPath(); ctx.moveTo(x - w * 0.5, top + h * t); ctx.lineTo(x + w * 0.5, top + h * t); ctx.stroke(); }
      }
    }
    // 相棒をかくれ場所のうしろに描く。かくれ場所の幅より外ははみ出さない
    function drawPetBehind(s, lift) {
      if (!pet.complete || !pet.naturalWidth) return;
      const h = PET_H, w = h * pet.naturalWidth / pet.naturalHeight, top = s.bottom - s.h;
      ctx.save(); ctx.beginPath(); ctx.rect(s.x - s.w / 2 + 8, 0, s.w - 16, s.bottom); ctx.clip();
      ctx.drawImage(pet, s.x - w / 2, top + 30 - lift, w, h); ctx.restore();
    }
    const heart = (x, y, r) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(r / 20, r / 20); ctx.beginPath();
      ctx.moveTo(0, 18); ctx.bezierCurveTo(-26, 0, -18, -22, 0, -10); ctx.bezierCurveTo(18, -22, 26, 0, 0, 18);
      ctx.fillStyle = '#ef8f9b'; ctx.fill(); ctx.lineWidth = 2.5 * 20 / r; ctx.strokeStyle = ink; ctx.stroke(); ctx.restore();
    };
    let hearts = [];
    function frame() {
      const now = performance.now(), t = now - stateAt;
      garden();
      // ヒント：ときどき耳がのぞく。その前に、かくれ場所がもぞもぞゆれる
      let lift = 0;
      if (state === 'hide') {
        if (now > nextHint) { shake[at] = Math.max(shake[at], 0.6); hintAt = now; nextHint = now + 2600 + Math.random() * 1200; }
        const since = now - hintAt; // ゆれた少しあとに、耳がのぞく
        lift = since > 300 && since < 1300 ? 64 * Math.sin((since - 300) / 1000 * Math.PI) : 0;
      }
      if (state === 'pop') { // 顔を出して、少ししたら別の場所へ
        lift = Math.min(1, t / 200) * 92;
        if (t > 900) { hideAgain(); play('tap'); pop('ささっ', SPOTS[at].x, 160, '#6a8fb0'); }
      }
      for (let i = 0; i < SPOTS.length; i++) {
        const s = SPOTS[i], dx = Math.sin(now / 40) * 6 * shake[i];
        shake[i] *= 0.92;
        if (i === at && state !== 'home') drawPetBehind(s, lift);
        drawSpot(s, dx);
      }
      if (state === 'home' && pet.complete && pet.naturalWidth) { // 出てきて、手前まで来る
        const s = SPOTS[at], k = Math.min(1, t / 900), h = PET_H + 40 * k, w = h * pet.naturalWidth / pet.naturalHeight;
        const x = s.x + (256 - s.x) * k, b = s.bottom + (500 - s.bottom) * k - Math.abs(Math.sin(k * Math.PI * 3)) * 20 * (1 - k);
        ctx.fillStyle = 'rgba(58,48,42,.16)'; ctx.beginPath(); ctx.ellipse(x, b, w * 0.4, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.drawImage(pet, x - w / 2, b - h, w, h);
        if (k >= 1 && !done) finish();
      }
      if (done) {
        if (hearts.length < 12 && Math.random() < 0.1) hearts.push({ x: 160 + Math.random() * 190, y: 360, r: 10 + Math.random() * 10, life: 1 });
        hearts = hearts.filter(h => (h.life -= 0.006) > 0);
        for (const h of hearts) { h.y -= 0.8; ctx.globalAlpha = Math.min(1, h.life * 1.6); heart(h.x, h.y, h.r); ctx.globalAlpha = 1; }
      }
      pops = pops.filter(p => (p.life -= 0.018) > 0);
      ctx.font = '28px "Yusei Magic", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      for (const p of pops) { p.y -= 0.6; ctx.globalAlpha = Math.min(1, p.life * 2); ctx.strokeStyle = '#fffdf8'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1; }
      raf = requestAnimationFrame(frame);
    }
    frame();

    function finish() {
      done = true;
      const quality = misses <= 2 ? 'good' : 'normal';
      play('done');
      how(quality === 'good' ? 'すぐに見つけてくれた！ おかえり' : 'やっと見つけた！ おかえり');
      const ok = document.createElement('button');
      ok.className = 'btn primary wide mg-ok';
      ok.textContent = 'いっしょに帰る';
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
