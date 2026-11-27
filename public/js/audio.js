// 音：BGM と効果音。ファイルは assets/audio/（出どころは CREDITS.txt と法的表示）。
// 鳴らすのは最初のタップのあとから（スマホの自動再生の制限への対策）。
// ファイルが読めないとき（artifacts のプレビューなど）は、効果音だけその場で合成した音で代わりにする。
const DIR = 'assets/audio/';
// 場所ごとの曲。ミニゲームとお絵かきの間は、その場所の曲を小さくして流し続ける
const BGM = { room: 'hinatabokko.mp3', cafe: 'nohohonkissa.mp3' };
const QUIET = 0.35; // ミニゲーム・お絵かきの間の BGM の大きさ（ふだんに対する割合）
const BGM_GAIN = 0.5, SE_GAIN = 0.8; // 音量のつまみを最大にしたときの大きさ
// 効果音の名前 → ファイル。pet は相棒をなでた・相棒が応えたとき（鳴き声の代わり）
// shower・bubble は、動かしている間だけ鳴らし続ける音（loopSe）
const SE = { tap: 'tap.ogg', happy: 'happy.ogg', done: 'complete.ogg', pet: 'pet.ogg', shower: 'shower.mp3', bubble: 'bubble.mp3' };

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
        Object.values(SE).forEach(load);
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

export function play(name) {
  if (!ctx || !getPrefs().sound || !SE[name]) return;
  load(SE[name]).then(buf => {
    if (!buf) return synth(name);
    const s = ctx.createBufferSource();
    s.buffer = buf; s.connect(seBus); s.start();
  });
}

// 鳴らし続ける効果音。止めるための関数を返す（何度呼んでもよい）
//   gap：1回鳴らし終わってから、次を鳴らすまでの秒数
//     0 ならすき間なくつなぐ。マイナスにすると、終わりをその分だけ切って次を重ねる（最後の無音を消すのに使う）
//     例：シャワー（長い音をそのままつなぐ）loopSe('shower', -0.35)
//         泡（短い音を一定の間隔でくり返す）loopSe('bubble', -0.62, { vary: 0.15 })
//   vary：1回ごとに音の高さを、この割合だけばらつかせる（同じ音のくり返しが機械っぽくならないように）
// ファイルが読めないとき（プレビューなど）や音がオフのときは、何も鳴らさない
export function loopSe(name, gap = 0, { vary = 0 } = {}) {
  if (!ctx || !getPrefs().sound || !SE[name]) return () => {};
  const out = ctx.createGain();
  out.connect(seBus);
  let stopped = false, timer = 0, next = 0;
  const sources = [];
  load(SE[name]).then(buf => {
    if (stopped || !buf) return;
    const period = Math.max(0.05, buf.duration + gap);
    next = ctx.currentTime + 0.02;
    // 少し先まで予約しておく（タイマーのずれで途切れないように）
    const fill = () => {
      while (next < ctx.currentTime + 0.3) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        if (vary) s.playbackRate.value = 1 + (Math.random() * 2 - 1) * vary;
        s.connect(out);
        s.start(next);
        if (gap < 0) s.stop(next + period); // 切った終わりは鳴らさない
        sources.push(s);
        s.onended = () => sources.splice(sources.indexOf(s), 1);
        next += period;
      }
    };
    fill();
    timer = setInterval(fill, 50);
  });
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    const t = ctx.currentTime;
    out.gain.setTargetAtTime(0, t, 0.04); // ぷつっと切れないよう、さっと小さくしてから止める
    for (const s of sources) { try { s.stop(t + 0.2); } catch {} }
  };
}

// ファイルが読めないときの代わり（その場で合成する短い音）
const NOTES = {
  tap: [[660, 0.05]],
  happy: [[784, 0.08], [988, 0.1]],
  done: [[523, 0.08], [659, 0.08], [784, 0.14]],
  pet: [[988, 0.06], [1175, 0.12]],
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
