// ミニゲームをひとつずつ開いて、描画されること・やめると { done:false } が返ることを確かめる。
// 迎えに行く（かくれんぼ）とぬいぐるみは、最後まで遊んで { done:true } が返ることも確かめる。
import { open, check, finish, OUT } from './helpers.mjs';

const { page, errors, close } = await open();
const r = [];
const PET = 'assets/pen/cat3.png';
const GAMES = [
  ['料理', 'mg-cook.js', 'cookGame', `{ dish: { name: 'コーヒー', cat: 'drink', image: 'assets/pen/food-coffee.svg' } }`],
  ['お風呂', 'mg-bath.js', 'bathGame', `{ petName: 'しろ', petImage: '${PET}' }`],
  ['ボール', 'mg-play.js', 'playGame', `'ball', { petName: 'しろ', petImage: '${PET}', toy: { name: 'ボール', image: 'assets/pen/toy-ball.svg' } }`],
  ['猫じゃらし', 'mg-play.js', 'playGame', `'wand', { petName: 'しろ', petImage: '${PET}', toy: { name: '猫じゃらし', image: 'assets/pen/toy-wand.svg' } }`],
  ['ぬいぐるみ', 'mg-play.js', 'playGame', `'plush', { petName: 'しろ', petImage: '${PET}', toy: { name: 'ぬいぐるみ', image: 'assets/pen/toy-plush.svg' } }`],
  ['迎えに行く', 'mg-chase.js', 'chaseGame', `{ petName: 'しろ', petImage: '${PET}' }`],
];
const start = (file, fn, args) => page.evaluate(`window._r = undefined; import('./js/${file}').then(m => m.${fn}(${args})).then(v => window._r = v); null`);
const P = async (x, y) => { const b = await page.locator('.mg-canvas').boundingBox(); return [b.x + x / 512 * b.width, b.y + y / 512 * b.height]; };
// 起動画面の上で遊ぶと隠れるので、先に消しておく
await page.waitForSelector('#splash.ready', { timeout: 10000 }); await page.click('#splash'); await page.waitForSelector('#splash', { state: 'detached' });
await page.evaluate(() => document.getElementById('modal-root').hidden = true);

for (const [name, file, fn, args] of GAMES) {
  try {
    await start(file, fn, args);
    await page.waitForSelector('#editor:not([hidden]) .mg-canvas'); await page.waitForTimeout(600);
    const painted = await page.evaluate(() => { const c = document.querySelector('.mg-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i]) n++; return n; });
    check(r, `${name}：描画される`, painted > 50);
    if (name === 'ぬいぐるみ') { // わたす → 4回ぎゅっ
      await page.mouse.move(...await P(110, 380)); await page.mouse.down();
      for (let k = 1; k <= 10; k++) await page.mouse.move(...await P(110 + k * 19, 380));
      await page.mouse.up(); await page.waitForTimeout(300);
      for (let i = 0; i < 4; i++) { await page.waitForTimeout(500); await page.mouse.click(...await P(300, 350)); }
    }
    if (name === '迎えに行く') { // 当たるまで順にタップ ×3
      const spots = [[110, 290], [256, 290], [404, 290], [170, 420], [360, 420]];
      for (let round = 0; round < 3; round++) {
        const before = await page.textContent('#mg-count');
        for (const s of spots) { await page.mouse.click(...await P(...s)); await page.waitForTimeout(150); if (await page.textContent('#mg-count') !== before) break; }
        await page.waitForTimeout(1300);
      }
      await page.waitForTimeout(1500);
    }
    if (await page.locator('.mg-ok').count()) await page.click('.mg-ok'); else await page.click('[data-mg="quit"]');
    await page.waitForFunction(() => window._r !== undefined, null, { timeout: 3000 });
    const res = await page.evaluate(() => window._r);
    const expectDone = name === 'ぬいぐるみ' || name === '迎えに行く';
    check(r, `${name}：${expectDone ? '最後まで遊ぶと done:true' : 'やめると done:false'}`, res.done === expectDone, JSON.stringify(res));
  } catch (e) {
    check(r, `${name}：途中で止まらない`, false, e.message.split('\n')[0]);
    await page.screenshot({ path: OUT + `mg-error-${name}.png` });
    if (await page.locator('[data-mg="quit"]').count()) await page.click('[data-mg="quit"]');
  }
}
await close();
finish(r, errors);
