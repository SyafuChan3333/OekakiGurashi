// 通しプレイ：起動 → 相棒を迎える → おへや → カフェで1人に出す → コンビニ → 設定（セーブ）→ ハラハラの出来事
import { open, passSplash, createPet, check, finish, OUT } from './helpers.mjs';

const { page, errors, close } = await open({ query: '?debug' });
const r = [];
const wait = ms => page.waitForTimeout(ms);
try {
  await passSplash(page);
  check(r, '起動画面をタップで抜けると、はじめかたが出る', await page.locator('#pet-name').count());
  await createPet(page);
  check(r, '相棒を迎えると、ステータス欄が出る', await page.locator('#pet-card').count());
  await page.screenshot({ path: OUT + 'smoke-room.png' });

  // おへや：バッグのおもちゃ → 遊びのミニゲームが開いて、やめると戻る
  await page.click('[data-a="bag"]');
  await page.locator('[data-act="toy"]').first().click();
  await page.waitForSelector('#editor:not([hidden]) .mg-canvas');
  check(r, 'バッグのおもちゃで遊びが始まる', (await page.textContent('.ed-title')).includes('投げる'));
  await page.click('[data-mg="quit"]');
  check(r, 'やめると部屋に戻る', await page.locator('#editor[hidden]').count());

  // お風呂
  await page.click('[data-a="bath"]');
  await page.waitForSelector('#editor:not([hidden]) .mg-canvas');
  check(r, 'お風呂が始まる', true);
  await page.click('[data-mg="quit"]');

  // カフェ：最初のお客さまは甘いもの。魔法のペンで新しく描いて、作って（飾る）、出す
  await page.click('[data-page="cafe"]'); await wait(500);
  await page.click('[data-a="menu"]'); await wait(200);
  await page.click('[data-act="new"]'); await wait(200);
  await page.click('[data-act="pen"]'); await wait(200);
  await page.locator('[data-act="pick"]').first().click();
  await page.waitForSelector('[data-act="ok"]'); await page.click('[data-act="ok"]'); await wait(200);
  await page.click('[data-act="ok"]'); await wait(300);
  await page.click('[data-a="cook"]');
  await page.waitForSelector('#editor:not([hidden]) .mg-canvas');
  const title = await page.textContent('.ed-title');
  check(r, '甘いものは「飾る」', title.endsWith('飾る'), title);
  const b = await page.locator('.mg-canvas').boundingBox();
  for (const [x, y] of [[200, 150], [260, 120], [320, 160], [220, 240], [290, 250], [256, 190]]) { await page.mouse.click(b.x + x / 512 * b.width, b.y + y / 512 * b.height); await wait(120); }
  await page.waitForSelector('.mg-ok', { timeout: 5000 });
  await page.click('.mg-ok'); await wait(300);
  const before = Number(await page.textContent('#coins'));
  await page.click('[data-a="serve"]'); await wait(1200);
  const after = Number(await page.textContent('#coins'));
  check(r, '出すとコインが増える', after > before, `${before} → ${after}`);
  check(r, '出したあとは「つぎのお客さま」が出る', await page.locator('#next-guest:not([hidden])').count());
  await page.click('#next-guest', { force: true }); await wait(400);

  // コンビニ
  await page.click('[data-page="shop"]'); await wait(400);
  await page.click('[data-a="buy"]'); await wait(200);
  check(r, 'コンビニで商品が並ぶ', await page.locator('[data-act="buy"]').count() > 0);
  await page.click('.sheet-close');

  // 設定：セーブの書き出しと読み込み
  await page.click('#settings'); await wait(200);
  await page.click('[data-act="export"]'); await wait(200);
  const save = await page.inputValue('#save-text');
  check(r, 'セーブを文字で書き出せる', save.length > 100, `${save.length} 文字`);
  await page.click('.sheet-close');

  // 開発用：逃げた状態 → 迎えに行く → やめる
  await page.click('[data-page="room"]'); await wait(300);
  await page.click('#settings'); await wait(200);
  await page.click('details.debug summary'); await page.click('[data-act="dbg-escape"]'); await wait(400);
  check(r, '逃げると知らせが出る', await page.locator('#alert:not([hidden])').count());
  await page.click('#alert [data-a="chase"]');
  await page.waitForSelector('#editor:not([hidden]) .mg-canvas');
  check(r, '迎えに行くが始まる', (await page.textContent('.ed-title')).includes('迎えに行く'));
  await page.click('[data-mg="quit"]');
  await page.screenshot({ path: OUT + 'smoke-end.png' });
} catch (e) {
  check(r, '途中で止まらない', false, e.message.split('\n')[0]);
  await page.screenshot({ path: OUT + 'smoke-error.png' });
}
await close();
finish(r, errors);
