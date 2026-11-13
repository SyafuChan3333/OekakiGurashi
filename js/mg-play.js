// ミニゲーム：おもちゃで遊ぶ（3.4 の枠で、結果 { done, quality } を返す）
// おもちゃの種類で遊び方が決まる。自作のおもちゃも、種類を選べば同じ遊びになる。
//   ボール → 投げる：引っぱって離す。待っている相棒に届けばキャッチ（3回）
//   猫じゃらし → 振る：振って気をひき、ぴたっと止めると飛びつく（5回）
//   ぬいぐるみ → ぎゅっとする：相棒にわたして、ハートがいちばん大きいときにタップ（4回）
// 長押し・ダブルタップは使わない（4.5）。遊びに「失敗」はない。うまくいくと出来ばえ「よい」。
import { $, esc } from './ui.js';
import { onDrag } from './input.js';
import { play } from './audio.js';

const SIZE = 512, FLOOR = 440;
const KINDS = {
  ball: { verb: '投げる', how: '相棒が待っているところへ、ボールを投げよう（3回）' },
  wand: { verb: '振る', how: '振って気をひいて、ぴたっと止めると飛びつくよ（5回）' },
  plush: { verb: 'ぎゅっとする', how: 'ぬいぐるみを、ドラッグして相棒にわたそう' },
};

const load = src => { const i = new Image(); i.src = src; return i; };
const ready = img => img.complete && img.naturalWidth > 0;

export function playGame(type, { petName, petImage, toy }) {
  const kind = KINDS[type] ? type : 'ball';
  return new Promise(resolve => {
    const root = $('#editor');
    root.hidden = false;
    document.body.classList.add('editing');
    root.innerHTML = `
      <div class="ed-top">
        <button class="btn" data-mg="quit">やめる</button>
        <b class="ed-title"><span class="nb">${esc(toy.name)}を</span><span class="nb">${KINDS[kind].verb}</span></b>
        <span aria-hidden="true"></span>
      </div>
      <p class="mg-how" id="mg-how">${esc(KINDS[kind].how)}</p>
      <div class="mg-progress"><span class="mg-count" id="mg-count"></span><div class="mg-bar"><b id="mg-bar"></b></div></div>
      <div class="ed-canvas-wrap"><canvas width="${SIZE}" height="${SIZE}" class="ed-canvas mg-canvas play"></canvas></div>`;
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
    const petImg = load(petImage), toyImg = load(toy.image);
    let done = false, raf = 0;
    const how = t => { $('#mg-how').textContent = t; };
    const setBar = v => { $('#mg-bar').style.width = `${Math.round(Math.min(1, v) * 100)}%`; };
    const setCount = t => { $('#mg-count').textContent = t; };
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height }; };

    // ---- 共通の描画 ----
    const room = () => {
      ctx.fillStyle = '#f6ecdc'; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#e6cfa8'; ctx.fillRect(0, FLOOR - 20, SIZE, SIZE);
      ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, FLOOR - 20); ctx.lineTo(SIZE, FLOOR - 20); ctx.stroke();
    };
    // 絵を「足もと中央」を基準に置く。sx/sy でつぶす・のばす
    const drawAt = (img, cx, bottom, h, { sx = 1, sy = 1, rot = 0, flip = false } = {}) => {
      if (!ready(img)) return { w: h, h };
      const w = h * img.naturalWidth / img.naturalHeight;
      ctx.save(); ctx.translate(cx, bottom); ctx.rotate(rot); ctx.scale(sx * (flip ? -1 : 1), sy);
      ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
      return { w, h };
    };
    const shadow = (x, r) => { ctx.fillStyle = 'rgba(58,48,42,.16)'; ctx.beginPath(); ctx.ellipse(x, FLOOR, r, r * 0.22, 0, 0, Math.PI * 2); ctx.fill(); };
    let pops = []; // 「ナイス！」などの文字
    const pop = (text, x, y, color = '#e0794f') => pops.push({ text, x, y, life: 1, color });
    const drawPops = () => {
      pops = pops.filter(p => (p.life -= 0.018) > 0);
      ctx.font = '28px "Yusei Magic", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      for (const p of pops) {
        p.y -= 0.6; ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.strokeStyle = '#fffdf8'; ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
      }
    };
    const heart = (x, y, r, fill = '#ef8f9b') => {
      ctx.save(); ctx.translate(x, y); ctx.scale(r / 20, r / 20); ctx.beginPath();
      ctx.moveTo(0, 18); ctx.bezierCurveTo(-26, 0, -18, -22, 0, -10); ctx.bezierCurveTo(18, -22, 26, 0, 0, 18);
      ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5 * 20 / r; ctx.strokeStyle = '#3a302a'; ctx.stroke(); ctx.restore();
    };

    // ---- 遊びの種類ごと ----
    const games = {
      // ボール：引っぱって離すと飛ぶ（パチンコ型）。待っている相棒に届けばノーバウンドでキャッチ
      // 絵を回転させると軸がずれて見えるので、ボールは放物線に沿って動かすだけ
      ball() {
        const NEED = 3, R = 28, G = 0.55, K = 0.09, MAX_PULL = 140, GUIDE = 22; // GUIDE：道すじを何コマ先まで見せるか
        const HOLD = { x: 130, y: 300 }, PET_HOME = 210;
        let throws = 0, catches = 0, phase = 'move'; // move（相棒が待つ場所へ）→ aim → fly →（catch / fetch）→ back
        let ball = { ...HOLD, vx: 0, vy: 0, landed: false }, pet = { x: PET_HOME, dir: 1, hop: 0, jy: 0 }, spot = 0;
        let pull = null, origin = null, jump = 0, touched = false, aimAt = 0; // touched：一度でも触ったら、お手本を出さない
        const newSpot = () => { spot = 290 + Math.random() * 130; phase = 'move'; };
        newSpot();
        setCount(`0/${NEED}`);
        const launchV = (q = pull) => ({ vx: -q.x * K, vy: -q.y * K });
        onDrag(cv, {
          start: e => {
            if (done || phase !== 'aim') return;
            const p = pos(e);
            if (Math.hypot(p.x - HOLD.x, p.y - HOLD.y) > 100) return;
            origin = p; pull = { x: 0, y: 0 }; touched = true;
          },
          move: e => {
            if (!origin) return;
            const p = pos(e); let x = p.x - origin.x, y = p.y - origin.y;
            const len = Math.hypot(x, y); if (len > MAX_PULL) { x *= MAX_PULL / len; y *= MAX_PULL / len; }
            pull = { x, y };
          },
          end: () => {
            if (!origin) return;
            origin = null;
            if (Math.hypot(pull.x, pull.y) < 25 || pull.x > 0) { pull = null; return; } // 引きが足りない／うしろ向きは取り消し
            const v = launchV(); pull = null;
            ball = { ...HOLD, ...v, landed: false }; phase = 'fly';
            play('tap');
          },
        });
        let ballDemo = null;
        const mouth = () => ({ x: pet.x + pet.dir * 14, y: FLOOR - pet.jy - 62 }); // 口もと（あごの下あたり）
        const nextThrow = () => {
          throws++; setCount(`${throws}/${NEED}`); setBar(throws / NEED);
          ball = { ...HOLD, vx: 0, vy: 0, landed: false };
          if (throws >= NEED) { phase = 'end'; finish(catches >= 2 ? 'good' : 'normal', catches >= 2 ? `ナイスキャッチ${catches}回！ 大よろこび` : 'いっぱい走って、まんぞく'); }
          else newSpot();
        };
        const walk = (to, sp) => { const dx = to - pet.x; if (Math.abs(dx) > 1) pet.dir = Math.sign(dx); pet.x += Math.sign(dx) * Math.min(Math.abs(dx), sp); pet.hop += 0.35; return Math.abs(dx) < 2; };
        return () => {
          room();
          // 相棒が待つ場所のしるし
          if (phase === 'move' || phase === 'aim' || phase === 'fly' && !ball.landed) {
            ctx.strokeStyle = 'rgba(224,121,79,.7)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
            ctx.beginPath(); ctx.ellipse(spot, FLOOR - 4, 58, 14, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          }
          // ---- 相棒 ----
          if (phase === 'move') {
            if (walk(spot, 6)) { phase = 'aim'; aimAt = performance.now(); pet.dir = -1; pet.hop = 0; pop('ここ！', spot, FLOOR - 200); how('ボールをつかんで引っぱって、離して投げよう'); }
          } else if (phase === 'fly') {
            if (!ball.landed && ball.vy > 0 && Math.abs(ball.x - pet.x) < 62 && ball.y > FLOOR - 270 && ball.y < FLOOR - 40) {
              phase = 'catch'; jump = 0; catches++; play('happy'); pop('ナイスキャッチ！', pet.x, FLOOR - 220); how('ナイスキャッチ！ 持ってきてくれるよ');
            }
            if (ball.landed) walk(ball.x, 6);
          } else if (phase === 'catch') { // とびあがってくわえる
            jump += 1 / 30; pet.jy = Math.sin(Math.min(1, jump) * Math.PI) * 70;
            if (jump >= 1) { pet.jy = 0; phase = 'back'; }
          } else if (phase === 'fetch') {
            if (walk(ball.x, 6)) { phase = 'back'; play('meow'); }
          } else if (phase === 'back') {
            if (walk(PET_HOME, 5)) nextThrow();
          } else pet.hop = 0;
          // ---- ボール ----
          if (phase === 'fly') {
            ball.vy += G; ball.x += ball.vx; ball.y += ball.vy;
            if (ball.x > SIZE - R) { ball.x = SIZE - R; ball.vx *= -0.5; }
            if (ball.x < R) { ball.x = R; ball.vx *= -0.5; }
            if (ball.y > FLOOR - R) {
              ball.y = FLOOR - R;
              if (!ball.landed) { ball.landed = true; play('tap'); how('おしい！ 取ってきてくれるよ'); }
              ball.vy *= -0.45; ball.vx *= 0.8;
              if (Math.abs(ball.vy) < 1.5) ball.vy = 0;
            }
            if (ball.landed && ball.vy === 0) { ball.vx *= 0.9; if (Math.abs(ball.vx) < 0.3) { ball.vx = 0; phase = 'fetch'; } }
          }
          if (phase === 'catch' || phase === 'back') { const m = mouth(); ball.x = m.x; ball.y = m.y; }
          const hy = Math.abs(Math.sin(pet.hop)) * 12 + pet.jy;
          shadow(pet.x, 60);
          drawAt(petImg, pet.x, FLOOR - hy, 170, { flip: pet.dir < 0 });
          // 引っぱっているあいだ：ゴムひもと、飛ぶ道すじ（はじめのほうだけ）
          // まだ触っていないとき：ボールが弾んで輪が広がる。はじめての1投は、指のお手本が引っぱって見せる
          let bx = ball.x, by = ball.y;
          if (phase === 'aim') {
            const now = performance.now();
            let q = pull, demo = null;
            if (!pull && !touched && throws === 0) { // お手本：つかむ → 引く → 離す（投げずに戻る）
              const t = (now - aimAt) % 2800, ease = v => v * v * (3 - 2 * v);
              const k = t < 500 ? 0 : t < 1500 ? ease((t - 500) / 1000) : t < 2100 ? 1 : t < 2250 ? 1 - (t - 2100) / 150 : 0;
              q = { x: -75 * k, y: 65 * k };
              demo = { alpha: t < 300 ? t / 300 : t < 2250 ? 1 : Math.max(0, 1 - (t - 2250) / 300), press: t >= 400 && t < 2100 };
            }
            bx = HOLD.x + (q?.x || 0); by = HOLD.y + (q?.y || 0);
            if (q && Math.hypot(q.x, q.y) >= 25 && q.x <= 0) {
              ctx.globalAlpha = demo ? 0.55 : 1;
              ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.moveTo(HOLD.x, HOLD.y); ctx.lineTo(bx, by); ctx.stroke();
              let { vx, vy } = launchV(q), x = HOLD.x, y = HOLD.y;
              ctx.fillStyle = '#e0794f';
              for (let i = 1; i <= GUIDE; i++) {
                vy += G; x += vx; y += vy;
                if (i % 2 === 0) { ctx.globalAlpha = (demo ? 0.55 : 1) * (1 - i / (GUIDE + 4)); ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
              }
              ctx.globalAlpha = 1;
            } else if (!pull) {
              by -= Math.abs(Math.sin(now / 260)) * 8; // ぽんぽん弾む
              const r = (now % 1400) / 1400; // 広がって消える輪
              ctx.strokeStyle = `rgba(224,121,79,${0.6 * (1 - r)})`; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.arc(HOLD.x, HOLD.y, R + 6 + r * 34, 0, Math.PI * 2); ctx.stroke();
            }
            if (demo) ballDemo = { x: bx, y: by, ...demo };
          }
          {
            if (by < FLOOR - R - 4) shadow(bx, 18 * Math.max(0.3, 1 - (FLOOR - by) / 400));
            drawAt(toyImg, bx, by + R * 1.5, R * 3); // 回転なし。絵のふちの余白ぶん大きめに
          }
          if (ballDemo) { // お手本の指（白い指先）
            const d = ballDemo; ballDemo = null;
            ctx.globalAlpha = d.alpha * 0.85; ctx.fillStyle = '#fffdf8'; ctx.strokeStyle = '#3a302a'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(d.x + 10, d.y + 14, d.press ? 15 : 17, d.press ? 19 : 21, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.globalAlpha = 1;
          }
        };
      },

      // 猫じゃらし：振るとわくわくがたまり、止めたとき届けば飛びつく
      wand() {
        const NEED = 5;
        let finger = { x: 360, y: 260 }, feather = { x: 360, y: 260, vx: 0, vy: 0 }, prev = { ...finger };
        let speed = 0, still = 0, exc = 0, pounces = 0, bigs = 0, pet = { x: 200, dir: 1 }, jump = null;
        setCount(`0/${NEED}`);
        onDrag(cv, {
          start: e => { if (!done) finger = pos(e); },
          move: e => { if (!done) finger = pos(e); },
          end: () => {},
        });
        return () => {
          room();
          // 指の速さ（なめらかにならす）
          const d = Math.hypot(finger.x - prev.x, finger.y - prev.y); prev = { ...finger };
          speed = speed * 0.8 + d * 0.2;
          // 先っぽは、少し遅れてしなるようについてくる
          feather.vx = (feather.vx + (finger.x - feather.x) * 0.12) * 0.82; feather.vy = (feather.vy + (finger.y - feather.y) * 0.12) * 0.82;
          feather.x += feather.vx; feather.y = Math.min(FLOOR - 10, feather.y + feather.vy);
          // わくわく：振るとたまる。じっとしすぎると少し冷める
          if (!jump) {
            if (speed > 3) { exc = Math.min(1, exc + Math.min(speed, 30) / 30 * 0.03); still = 0; }
            else { still++; if (still > 90) exc = Math.max(0, exc - 0.004); }
            const reach = Math.abs(feather.x - pet.x) < 180 && feather.y > 150;
            if (still === 10 && exc > 0.3 && reach) { // ぴたっと止まった
              jump = { t: 0, x0: pet.x, x1: Math.max(60, Math.min(SIZE - 60, feather.x)), top: feather.y + 60, big: exc >= 0.75 };
              play('meow');
            }
            // ふだんは羽根のほうへ少しずつ寄っていく
            const dx = feather.x - pet.x; pet.dir = Math.sign(dx) || pet.dir;
            if (Math.abs(dx) > 90) pet.x += Math.sign(dx) * Math.min(Math.abs(dx) - 90, 2.2);
          }
          let py = FLOOR, sq = 1;
          if (jump) {
            jump.t += 1 / 34;
            const t = Math.min(1, jump.t);
            pet.x = jump.x0 + (jump.x1 - jump.x0) * t;
            py = FLOOR - Math.sin(t * Math.PI) * Math.max(40, FLOOR - jump.top) * (jump.big ? 1 : 0.6);
            if (t >= 1) {
              pounces++; if (jump.big) bigs++;
              pop(jump.big ? '大ジャンプ！' : 'えいっ', pet.x, FLOOR - 190, jump.big ? '#e0794f' : '#6a8fb0');
              play(jump.big ? 'happy' : 'tap');
              feather.vy = -10; feather.vx = (Math.random() - 0.5) * 16; // じゃれられて羽根がはねる
              exc = 0; jump = null; still = 11;
              setCount(`${pounces}/${NEED}`); setBar(pounces / NEED);
              if (pounces >= NEED) finish(bigs >= 3 ? 'good' : 'normal', bigs >= 3 ? `大ジャンプ${bigs}回！ 大はしゃぎ` : 'いっぱいじゃれて、まんぞく');
            }
          } else if (exc > 0.3) sq = 1 - Math.sin(performance.now() / 70) * 0.04 * exc; // おしりふりふり
          shadow(pet.x, 60);
          drawAt(petImg, pet.x, py, 170, { sy: sq, sx: 2 - sq, flip: pet.dir < 0 });
          // わくわくの「！」
          const marks = Math.floor(exc * 3 + 0.01);
          ctx.font = '30px "Yusei Magic", sans-serif'; ctx.textAlign = 'center';
          for (let i = 0; i < marks; i++) { ctx.fillStyle = '#e0794f'; ctx.fillText('！', pet.x - 22 + i * 22, py - 182); }
          // おもちゃの絵そのものを振る。絵の右上あたりが先っぽ（指の位置）に来るように置く
          if (ready(toyImg)) {
            const h = 170, w = h * toyImg.naturalWidth / toyImg.naturalHeight;
            ctx.save(); ctx.translate(feather.x, feather.y); ctx.rotate(Math.max(-0.5, Math.min(0.5, feather.vx * 0.03)));
            ctx.drawImage(toyImg, -w * 0.63, -h * 0.3, w, h); ctx.restore();
          }
        };
      },

      // ぬいぐるみ：わたして、ハートが大きいときにぎゅっ
      plush() {
        const NEED = 4, PET = { x: 300 }, HOME = { x: 110, y: FLOOR - 10 };
        let phase = 'give', plush = { ...HOME }, drag = null, hugs = 0, best = 0, squeeze = 0, t0 = performance.now();
        setCount('わたす');
        onDrag(cv, {
          start: e => {
            if (done) return;
            const p = pos(e);
            if (phase === 'give') { if (Math.hypot(p.x - plush.x, p.y - (plush.y - 50)) < 90) drag = p; return; }
            // ぎゅっ：ハートの大きさで判定（いちばん大きいところが「ぴったり」）
            const beat = pulse();
            hugs++; squeeze = 1;
            if (beat > 0.82) { best++; play('happy'); pop('ぎゅっ！', PET.x, FLOOR - 200); }
            else { play('tap'); pop('ぎゅ', PET.x, FLOOR - 200, '#6a8fb0'); }
            setCount(`${hugs}/${NEED}`); setBar(hugs / NEED);
            if (hugs >= NEED) finish(best >= 3 ? 'good' : 'normal', best >= 3 ? `ぴったり${best}回！ ぽかぽか` : 'ぎゅっとして、ほっとした');
          },
          move: e => { if (drag) { const p = pos(e); plush.x = p.x; plush.y = Math.min(FLOOR - 10, p.y + 50); } },
          end: () => {
            if (!drag) return;
            drag = null;
            if (Math.abs(plush.x - PET.x) < 90) { // わたせた
              phase = 'hug'; play('meow'); t0 = performance.now();
              how('ハートがいちばん大きいときに、相棒をタップ（4回）'); setCount(`0/${NEED}`);
            } else plush = { ...HOME };
          },
        });
        // 1.3秒で大きくなって小さくなる
        const pulse = () => 0.5 - 0.5 * Math.cos((performance.now() - t0) / 1300 * Math.PI * 2);
        return () => {
          room();
          squeeze *= 0.88;
          shadow(PET.x, 62);
          const sx = 1 + squeeze * 0.12, sy = 1 - squeeze * 0.1;
          drawAt(petImg, PET.x, FLOOR, 175, { sx, sy, flip: true });
          if (phase === 'give') {
            shadow(plush.x, 34);
            drawAt(toyImg, plush.x, plush.y, 110);
            if (!drag) { ctx.strokeStyle = 'rgba(58,48,42,.35)'; ctx.setLineDash([8, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(plush.x + 50, plush.y - 60); ctx.lineTo(PET.x - 80, FLOOR - 80); ctx.stroke(); ctx.setLineDash([]); }
          } else {
            drawAt(toyImg, PET.x - 10, FLOOR - 10, 100, { sx, sy }); // だきしめている
            if (!done) {
              const b = pulse();
              ctx.strokeStyle = 'rgba(58,48,42,.3)'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
              ctx.beginPath(); ctx.arc(PET.x, FLOOR - 235, 34, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); // いちばん大きいときの目安
              heart(PET.x, FLOOR - 235, 12 + 22 * b, b > 0.82 ? '#e8606f' : '#ef8f9b');
            }
          }
        };
      },
    };

    const step = games[kind]();
    // 遊びおわりのハート：ふわっと上って消える
    let hearts = [];
    function frame() {
      step();
      if (done) {
        if (hearts.length < 14 && Math.random() < 0.12) hearts.push({ x: 120 + Math.random() * 280, y: FLOOR - 60, r: 10 + Math.random() * 10, life: 1, vx: (Math.random() - 0.5) * 0.6 });
        hearts = hearts.filter(h => (h.life -= 0.006) > 0);
        for (const h of hearts) { h.y -= 0.8; h.x += h.vx; ctx.globalAlpha = Math.min(1, h.life * 1.6); heart(h.x, h.y, h.r); ctx.globalAlpha = 1; }
      }
      drawPops();
      raf = requestAnimationFrame(frame);
    }
    frame();

    function finish(quality, msg) {
      if (done) return;
      done = true;
      play('done');
      how(msg);
      setBar(1);
      const ok = document.createElement('button');
      ok.className = 'btn primary wide mg-ok';
      ok.textContent = 'あそびおしまい';
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
