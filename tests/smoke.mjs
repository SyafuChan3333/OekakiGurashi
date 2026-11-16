// 通しプレイ：起動 → 相棒を迎える → おへや → カフェで1人に出す → コンビニ → 設定（セーブ）→ ハラハラの出来事
import { open, passSplash, check, finish, OUT } from './helpers.mjs';

const { page, errors, close } = await open({ query: '?debug' });
const r = [];
const wait = ms => page.waitForTimeout(ms);
try {
  await passSplash(page);
  check(r, '起動画面をタップで抜けると、まず絵を用意する画面が出る', await page.locator('[data-act="pen"]').count() && !(await page.locator('#pet-name').count()));
  check(r, '最初の画面から続きを読み込める', await page.locator('[data-act="import"]').count());
  // 1. 絵 → 2. 名前と性格 → 3. 確認 の一本道を、行き来しながら進む
  const h2 = async () => (await page.locator('#modal-root:not([hidden]) .sheet h2').allTextContents()).join();
  const pen = async i => { await page.click('[data-act="pen"]'); await page.click(`[data-act="pick"][data-i="${i}"]`); await page.waitForSelector('[data-act="ok"]', { timeout: 5000 }); await page.click('[data-act="ok"]'); };
  await pen(3);
  check(r, '絵を選ぶと名前の画面。用意した絵が出ている', (await h2()).includes('どんな子') && await page.locator('.sheet .paper img').count());
  await page.click('[data-act="back"]');
  check(r, '名前を入れる前にもどっても、絵の画面に戻る（近道の「確認にもどる」はない）', (await h2()).includes('相棒をむかえよう') && !(await page.locator('[data-act="back"]').count()));
  check(r, 'はじめかたの途中では閉じるボタンが出ない', !(await page.locator('.sheet-close').count()));
  await page.click('[data-act="pen"]');
  check(r, '魔法のペンの絵を選ぶ画面にも閉じるボタンが出ない', !(await page.locator('.sheet-close').count()));
  await page.click('[data-act="back"]');
  await pen(3);
  await page.fill('#pet-name', 'しろ'); await page.click('[data-id="curious"]'); await page.click('[data-act="next"]');
  check(r, '確認画面が出る', (await h2()).includes('この子でいい'));
  await page.click('[data-act="back"]');
  check(r, '確認からもどると名前の画面。名前は残っている', (await h2()).includes('どんな子') && await page.inputValue('#pet-name') === 'しろ');
  await page.click('[data-act="back"]'); await pen(5);
  check(r, '絵を選びなおしても、名前と性格は残っている', await page.inputValue('#pet-name') === 'しろ' && await page.locator('[data-id="curious"][aria-pressed="true"]').count());
  await page.click('[data-act="next"]');
  check(r, 'もう一度つぎへで確認画面', (await h2()).includes('この子でいい') && (await page.textContent('.sheet')).includes('しろ'));
  await page.click('[data-act="go"]'); await page.waitForSelector('#pet-card');
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

  // 見本を見せる：ポスターを、紙に描いた絵の写真から描いてもらう（設計書 2.5）
  await page.click('[data-page="room"]'); await wait(300);
  await page.click('[data-a="remodel"]'); await wait(200);
  await page.click('[data-act="poster"]'); await wait(200);
  await page.click('[data-act="pen"]'); await wait(200);
  check(r, '魔法のペンの一覧の先頭に「見本を見せる」がある', (await page.locator('.pen-grid > :first-child').getAttribute('data-act')) === 'sample');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-act="sample"]')]);
  await chooser.setFiles(new URL('./fixtures/sample-paper.jpg', import.meta.url).pathname);
  await page.waitForSelector('[data-act="white"]', { timeout: 6000 });
  const src0 = await page.getAttribute('.sheet .paper img', 'src');
  await page.click('[data-act="white"]'); await wait(200);
  const src1 = await page.getAttribute('.sheet .paper img', 'src');
  check(r, '見本の描き上がりで「白いところを消す」を切り替えられる', src0 !== src1 && (await page.getAttribute('[data-act="white"]', 'aria-pressed')) === 'true');
  check(r, '見本の描き上がりにも「自分で描き直す」はない', !(await page.locator('[data-act="redraw"]').count()));
  await page.screenshot({ path: OUT + 'smoke-sample.png' });
  await page.click('[data-act="ok"]'); await wait(400);
  // 自分で描いたポスターなら相棒が「きみの絵だ！」と言う。見本はペンの絵なので言わない
  check(r, '見本から描いた絵は、魔法のペンの絵として扱う', !(await page.textContent('#bubble-pet')).includes('きみの絵'));

  // スケッチブック：自分で描いたポスターは保存できる。魔法のペンの相棒は保存できない（設計書 2.6・2.7）
  await page.click('[data-page="room"]'); await wait(300);
  await page.click('[data-a="remodel"]'); await wait(200);
  await page.click('[data-act="poster"]'); await wait(200);
  await page.click('[data-act="self"]'); await page.waitForSelector('#editor:not([hidden]) .ed-canvas');
  { const b = await page.locator('.ed-canvas').boundingBox();
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3); await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(b.x + b.width * (0.3 + k * 0.04), b.y + b.height * (0.3 + k * 0.03));
    await page.mouse.up(); }
  await page.click('[data-ed="ok"]'); await wait(500);
  await page.click('#sketchbook-btn'); await wait(300);
  const items = await page.locator('.sketch-grid .pen-item').count();
  check(r, 'スケッチブックに、これまでの絵が並ぶ', items >= 2, `${items} 枚`);
  check(r, 'スケッチブックの先頭は、いまの相棒（魔法のペンの印つき）', (await page.textContent('.sketch-grid .pen-item:first-child')).includes('相棒') && await page.locator('.sketch-grid .pen-item:first-child .pen-mark').count());
  await page.click('.sketch-grid .pen-item:first-child'); await wait(200);
  check(r, '魔法のペンの絵は保存・共有できない', !(await page.locator('[data-act="save"], [data-act="share"]').count()) && (await page.textContent('.sheet')).includes('保存・共有できません'));
  await page.click('[data-act="back"]'); await wait(200);
  await page.locator('.sketch-grid .pen-item', { hasText: 'ポスター' }).filter({ hasNot: page.locator('.pen-mark') }).first().click(); await wait(200);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('[data-act="save"]')]);
  check(r, '自分で描いた絵は、背景が透明な画像として保存できる', /\.png$/.test(download.suggestedFilename()), download.suggestedFilename());
  await page.screenshot({ path: OUT + 'smoke-sketch.png' });
  await page.click('[data-act="back"]'); await wait(200);
  await page.screenshot({ path: OUT + 'smoke-sketchbook.png' });
  await page.click('.sheet-close'); await wait(200);

  // 魔法のペンの子：はじめの3日間は描き直せる。描き上がりに「自分で描き直す」はない。4日目からは手直しも出ない（設計書 2.7）
  await page.click('[data-page="room"]'); await wait(300);
  await page.click('#pet-card'); await wait(200);
  check(r, 'はじめの3日間は「描き直す」が出る', await page.locator('[data-act="redraw"]').count());
  await page.click('[data-act="redraw"]'); await wait(200);
  await page.click('[data-act="pen"]'); await page.click('[data-act="pick"][data-i="5"]');
  await page.waitForSelector('[data-act="ok"]', { timeout: 5000 });
  check(r, '魔法のペンの描き上がりに「自分で描き直す」がない', !(await page.locator('[data-act="redraw"]').count()) && await page.locator('[data-act="back"]').count());
  await page.click('[data-act="ok"]'); await wait(400);
  for (let i = 0; i < 3; i++) { await page.click('#settings'); await wait(150); await page.click('details.debug summary'); await page.click('[data-act="dbg-day"]'); await wait(250); }
  await page.click('#pet-card'); await wait(200);
  check(r, '4日目からは、魔法のペンの子に手直しも描き直しも出ない', !(await page.locator('[data-act="touchup"], [data-act="redraw"]').count()) && (await page.textContent('.sheet')).includes('手直しできません'));
  await page.click('.sheet-close'); await wait(200);

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
