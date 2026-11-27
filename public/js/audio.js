// 音：BGM と効果音。ファイルは assets/audio/（出どころは CREDITS.txt と法的表示）。
// 鳴らすのは最初のタップのあとから（スマホの自動再生の制限への対策）。
// ファイルが読めないとき（artifacts のプレビューなど）は、効果音だけその場で合成した音で代わりにする。
const DIR = 'assets/audio/';
// 場所ごとの曲。ミニゲームとお絵かきの間は、その場所の曲を小さくして流し続ける
const BGM = { room: 'hinatabokko.mp3', cafe: 'nohohonkissa.mp3' };
const QUIET = 0.35; // ミニゲーム・お絵かきの間の BGM の大きさ（ふだんに対する割合）
const BGM_GAIN = 0.5, SE_GAIN = 0.8; // 音量のつまみを最大にしたときの大きさ
// 効果音の一覧。音の区切り（どこを使うか・どこをくり返すか）はここに書き、鳴らす側は名前だけで呼ぶ
//   file：assets/audio/ のファイル
//   clip：[はじめ, おわり]（秒）。ファイルのこの部分だけを使う。長い音を短く切るときに（おわりの手前は自動で少し小さくして切る）
//   鳴らし続ける音（loopSe）は、次のどちらか
//     loop：[はじめ, おわり]（秒）。この区間をくり返す。その前はイントロ、その後はアウトロとして、
//           鳴らし始めにイントロ、止めたときにアウトロを鳴らす（イントロの途中で止めても、イントロは最後まで鳴らす）
//     every：秒。clip の音を、この間隔でくり返す（vary：1回ごとに高さをこの割合だけばらつかせる）
//   release：止めるときに、くり返していた音を小さくしていく秒数（アウトロがあれば、その間アウトロと重ねる。ふだんは 0.05）
// pet は相棒をなでた・相棒が応えたとき（鳴き声の代わり）
const SE = {
  tap: { file: 'tap.ogg' },
  happy: { file: 'happy.ogg' },
  done: { file: 'complete.ogg' },
  pet: { file: 'pet.ogg' },
  shower: { file: 'shower.mp3', loop: [0, 19.28], release: 0.15 }, // 最後の無音はくり返さない（止めたら 0.15 秒で消える）
  bubble: { file: 'bubble.mp3', clip: [0, 0.15], every: 0.5, vary: 0.15 },
  dryer: { file: 'dryer.mp3', loop: [1.2, 4.8] }, // 0〜1.2 秒がスイッチを入れる音、4.8 秒〜が止まる音
};

let ctx = null, bgmBus = null, seBus = null;
let getPrefs = () => ({ sound: true, bgmVolume: 0.5, seVolume: 0.7 });
let isQuiet = () => false;
let scene = null, playing = null; // 流したい曲 / いま流れている曲 { name, src, gain }
const buffers = {}; // ファイル名 → Promise<AudioBuffer | null>

const load = file => (buffers[file] ??= fetch(DIR + file)
  .then(r => (r.ok ? r.arrayBuffer() : Promise.reject()))
  .then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
  .catch(() => null));

export function initAudio({ prefs, quiet }) {
  getPrefs = prefs;
  if (quiet) isQuiet = quiet;
  const unlock = () => {
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        bgmBus = ctx.createGain(); bgmBus.connect(ctx.destination);
        seBus = ctx.createGain(); seBus.connect(ctx.destination);
        applyVolume();
        Object.values(SE).forEach(d => load(d.file));
        setInterval(applyVolume, 300); // ミニゲームに入った・出たで、BGM をなめらかに上げ下げ
      }
      ctx.resume?.();
      startBgm();
    } catch {}
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  // 画面を離れている間は止める
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.(); else ctx.resume?.();
  });
}

// 設定の音量を反映する（設定を変えたら呼ぶ。ふだんは 0.3 秒ごと）
export function applyVolume() {
  if (!ctx) return;
  const p = getPrefs(), on = p.sound ? 1 : 0;
  const bgm = on * p.bgmVolume * BGM_GAIN * (isQuiet() ? QUIET : 1);
  bgmBus.gain.setTargetAtTime(bgm, ctx.currentTime, 0.25);
  seBus.gain.setTargetAtTime(on * p.seVolume * SE_GAIN, ctx.currentTime, 0.02);
}

// 場所が変わったら呼ぶ（'room' | 'cafe'。コンビニは 'room'）。曲が変わるときは、ゆっくり入れ替える
export function setScene(name) {
  scene = BGM[name] ? name : 'room';
  startBgm();
}

async function startBgm() {
  if (!ctx || !scene || playing?.name === scene) return;
  const want = scene, buf = await load(BGM[want]);
  if (!buf || scene !== want || playing?.name === want) return;
  const old = playing, t = ctx.currentTime;
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = buf; src.loop = true;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(1, t + 1.5);
  src.connect(gain).connect(bgmBus);
  src.start();
  playing = { name: want, src, gain };
  if (old) {
    old.gain.gain.setTargetAtTime(0.0001, t, 0.4);
    old.src.stop(t + 2.5);
  }
}

// 1つの音を、clip の部分だけ鳴らす。dest につなぐ（ふだんは効果音の音量）
function hit(def, buf, when, dest, rate = 1) {
  const [a, b] = def.clip || [0, buf.duration], len = Math.min(b, buf.duration) - a;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = rate;
  src.connect(g).connect(dest);
  if (def.clip) { // 切ったところでぷつっと鳴らないよう、おわりの手前で小さくする
    const end = when + len / rate;
    g.gain.setValueAtTime(1, Math.max(when, end - 0.03));
    g.gain.linearRampToValueAtTime(0.0001, end);
  }
  src.start(when, a, len);
  return src;
}

export function play(name) {
  const def = SE[name];
  if (!ctx || !getPrefs().sound || !def) return;
  load(def.file).then(buf => (buf ? hit(def, buf, ctx.currentTime, seBus) : synth(name)));
}

// 鳴らし続ける効果音。止めるための関数 stop を返す。どう鳴らすかは SE の一覧の書き方で決まる
//   stop()：アウトロがあればアウトロを鳴らして終わる（イントロの途中なら、イントロのあとにアウトロ）。なければ release 秒で小さくして止める
//   stop({ now: true })：すぐに小さくして止める（ミニゲームをやめたときなど）。アウトロの途中でも止める
// 何度呼んでもよい。音がオフのときや、ファイルが読めないとき（プレビューなど）は何も鳴らさない
export function loopSe(name) {
  const def = SE[name];
  if (!ctx || !getPrefs().sound || !def) return () => {};
  const out = ctx.createGain();
  out.connect(seBus);
  let state = 'loading', timer = 0, main = null, mainGain = null, t0 = 0, buf = null;
  const sources = [];
  const kill = (fade = 0.06) => {
    clearInterval(timer);
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0.0001, t + fade);
    for (const s of sources) { try { s.stop(t + fade + 0.02); } catch {} }
    state = 'off';
  };

  load(def.file).then(b => {
    if (state !== 'loading' || !b) { state = 'off'; return; }
    buf = b; t0 = ctx.currentTime + 0.02; state = 'on';
    if (def.loop) {
      // 区間ループ：Web Audio の loop で、イントロ → 区間のくり返し をそのまま鳴らす
      main = ctx.createBufferSource();
      main.buffer = buf; main.loop = true;
      [main.loopStart, main.loopEnd] = def.loop;
      mainGain = ctx.createGain();
      main.connect(mainGain).connect(out); main.start(t0);
      sources.push(main);
    } else {
      // くり返し：少し先まで予約しておく（タイマーのずれで途切れないように）
      let next = t0;
      const fill = () => {
        while (next < ctx.currentTime + 0.3) {
          sources.push(hit(def, buf, next, out, def.vary ? 1 + (Math.random() * 2 - 1) * def.vary : 1));
          next += def.every;
        }
        while (sources.length > 8) sources.shift(); // 鳴り終わったものは手放す
      };
      fill();
      timer = setInterval(fill, 50);
    }
  });

  return ({ now = false } = {}) => {
    if (state === 'off') return;
    if (now || state === 'loading') return kill();
    if (state === 'outro') return;
    if (def.loop && def.loop[1] < buf.duration - 0.05) {
      // アウトロ：区間のおわりから先を、いますぐ（イントロ中なら、イントロのあとに）鳴らし、ループとは少し重ねてつなぐ
      state = 'outro';
      const at = Math.max(ctx.currentTime, t0 + def.loop[0]), x = def.release ?? 0.05;
      const outro = ctx.createBufferSource(), og = ctx.createGain();
      outro.buffer = buf; outro.connect(og).connect(out);
      og.gain.setValueAtTime(0.0001, at); og.gain.linearRampToValueAtTime(1, at + x);
      outro.start(at, def.loop[1]);
      sources.push(outro);
      mainGain.gain.setValueAtTime(1, at); mainGain.gain.linearRampToValueAtTime(0.0001, at + x);
      main.stop(at + x + 0.02);
      outro.onended = () => { state = 'off'; };
      return;
    }
    kill(def.release ?? 0.05);
  };
}

// ファイルが読めないときの代わり（その場で合成する短い音）
const NOTES = {
  tap: [[660, 0.05]],
  happy: [[784, 0.08], [988, 0.1]],
  done: [[523, 0.08], [659, 0.08], [784, 0.14]],
  pet: [[988, 0.06], [1175, 0.12]],
  shower: [], bubble: [], dryer: [],
};
function synth(name) {
  let t = ctx.currentTime;
  for (const [freq, len] of NOTES[name]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(seBus);
    o.start(t); o.stop(t + len + 0.02);
    t += len * 0.9;
  }
}
