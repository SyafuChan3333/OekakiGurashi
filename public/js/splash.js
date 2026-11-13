// 起動画面の後半：読み込みが終わり、タイトルを描き終えたら「タップしてはじめる」を出し、タップで閉じる。
// 最初のタップは音を鳴らせるようにする役目も兼ねる（iPhone はタップするまで音が出ない）。
// 遊んだことがある人には、その子の絵を出して迎える。
import { play } from './audio.js';

export function splashReady(petImage) {
  const el = document.getElementById('splash');
  if (!el) return Promise.resolve();
  const drawn = new Promise(res => {
    const text = el.querySelector('.sp-text');
    const done = () => res();
    text.addEventListener('animationend', done, { once: true });
    setTimeout(done, 3500); // 字体が届かない・動きを減らす設定などで animationend が来ないとき
  });
  return drawn.then(() => new Promise(resolve => {
    if (petImage) {
      const img = new Image(); img.alt = ''; img.draggable = false; img.src = petImage;
      el.querySelector('.sp-pet').appendChild(img);
    }
    el.querySelector('.sp-status').textContent = 'タップしてはじめる';
    el.classList.add('ready');
    el.addEventListener('pointerup', () => {
      setTimeout(() => play('happy'), 0); // 音の準備（pointerdown）のあとで鳴らす
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 360);
    }, { once: true });
  }));
}
