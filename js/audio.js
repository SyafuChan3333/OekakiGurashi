// 効果音。ファイルを使わず、その場で短い音を合成する（artifacts でも鳴る）。
// BGM は試作では入れていない。あとで assets/audio を使う形に差し替える。
let ctx = null, getPrefs = () => ({ sound: true, volume: 0.5 });

export function initAudio(prefs) {
  getPrefs = prefs;
  // 音は最初のタップのあとから（自動再生の制限への対策）
  const unlock = () => {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch {}
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}
export function setScene() {}

const NOTES = {
  tap: [[660, 0.05]],
  happy: [[784, 0.08], [988, 0.1]],
  done: [[523, 0.08], [659, 0.08], [784, 0.14]],
  meow: [[880, 0.06], [740, 0.12]],
};
export function play(name) {
  const p = getPrefs();
  if (!ctx || !p.sound || !NOTES[name]) return;
  let t = ctx.currentTime;
  for (const [freq, len] of NOTES[name]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (name === 'meow') o.frequency.exponentialRampToValueAtTime(freq * 0.8, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 * p.volume + 0.0001, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + len + 0.02);
    t += len * 0.9;
  }
}
