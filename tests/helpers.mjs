// ブラウザでの確認に使う共通の下ごしらえ。
// CHROME_PATH を指定するとそのブラウザを使う（未指定なら Playwright の Chromium）。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { startServer } from './server.mjs';

export const OUT = new URL('./out/', import.meta.url).pathname;

export async function open({ phone = true, query = '' } = {}) {
  await mkdir(OUT, { recursive: true });
  const { server, url } = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 760 } });
  // 字体はネットから取るので、テストでは待たない（なくても動く）
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url + 'index.html' + query);
  const close = async () => { await browser.close(); server.close(); };
  return { page, errors, close, url };
}

// 起動画面を抜ける
export async function passSplash(page) {
  await page.waitForSelector('#splash.ready', { timeout: 10000 });
  await page.click('#splash');
  await page.waitForSelector('#splash', { state: 'detached' });
}

// はじめかた：魔法のペンで絵 → 名前と性格 → 確認
export async function createPet(page, { name = 'しろ', personality = 'curious', pick = 3 } = {}) {
  await page.click('[data-act="pen"]');
  await page.click(`[data-act="pick"][data-i="${pick}"]`);
  await page.waitForSelector('[data-act="ok"]', { timeout: 5000 });
  await page.click('[data-act="ok"]');
  await page.fill('#pet-name', name);
  await page.click(`[data-id="${personality}"]`);
  await page.click('[data-act="next"]');
  await page.click('[data-act="go"]');
  await page.waitForSelector('#pet-card');
}

export function check(results, name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'NG  '} ${name}${detail ? ' — ' + detail : ''}`);
}

export function finish(results, errors) {
  if (errors.length) console.log('ページのエラー:\n  ' + errors.join('\n  '));
  const ng = results.filter(r => !r.ok).length + (errors.length ? 1 : 0);
  console.log(ng ? `\n${ng} 件 NG` : '\nすべて ok');
  process.exitCode = ng ? 1 : 0;
}
