// 音：BGM と効果音。ファイルは assets/audio/（出どころは CREDITS.txt と法的表示）。
// 鳴らすのは最初のタップのあとから（スマホの自動再生の制限への対策）。
// ファイルが読めないとき（artifacts のプレビューなど）は、効果音だけその場で合成した音で代わりにする。
const DIR = 'assets/audio/';
// 場所ごとの曲。ミニゲームとお絵かきの間は、その場所の曲を小さくして流し続ける
const BGM = { room: 'hinatabokko.mp3', cafe: 'nohohonkissa.mp3' };
const QUIET = 0.35; // ミニゲーム・お絵かきの間の BGM の大きさ（ふだんに対する割合）
const BGM_GAIN = 0.5, SE_GAIN = 0.8; // 音量のつまみを最大にしたときの大きさ
// 効果音の名前 → ファイル。相棒の声（meow）も、いまは happy と同じ音
const SE = { tap: 'tap.ogg', happy: 'happy.ogg', done: 'complete.ogg', meow: 'happy.ogg' };

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

// ファイルが読めないときの代わり（その場で合成する短い音）
const NOTES = {
  tap: [[660, 0.05]],
  happy: [[784, 0.08], [988, 0.1]],
  done: [[523, 0.08], [659, 0.08], [784, 0.14]],
  meow: [[784, 0.08], [988, 0.1]],
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
