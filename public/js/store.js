// ゲームの状態とルール。画面描画からは切り離す（6章）。
import { PEN_DISHES, STARTER_DISHES, GUESTS, HOUSES, CAFE_LEVELS, HARAHARA, SHOP_START, NEW_ITEM_PRICE, SELF_DISCOUNT } from './data.js';

const KEY = 'oekaki-kurashi-v2';
export const clamp = n => Math.max(0, Math.min(100, Math.round(n)));

export function newState() {
  return {
    v: 1,
    started: false,
    day: 1,
    coins: 350,
    mode: 'normal',       // 'normal' | 'harahara'
    modeNext: 'normal',   // 次の日から反映
    pet: null,            // { name, personality, image, self, createdDay }
    stats: { hunger: 70, mood: 70, bond: 30 },
    care: { dirty: 0, sick: 0, lonely: 0, status: 'ok' }, // status: ok | sick | escaped | gone
    shop: SHOP_START.map(x => ({ ...x, self: false })), // コンビニの商品
    bag: { 's-cookie': 2, 's-ball': 1 }, // 持ち物（はじめはクッキー2つとボール） { 商品id: 個数 }。おもちゃは1つあれば何度でも遊べる
    poster: null,         // おへやのポスター { image, self }
    house: 'washitsu',
    owned: ['washitsu'],
    cafe: {
      level: 0,
      menu: STARTER_DISHES.map(id => penDish(id)),
      guestNo: 0,
      picked: null,
      step: 'order',      // order | made | served
    },
    served: 0,
    memories: [],         // 手直し前の絵・お別れした子
    sound: true,
    volume: 0.5,
  };
}

function penDish(id) {
  const d = PEN_DISHES.find(x => x.id === id);
  return { id: 'm-' + id, name: d.name, cat: d.cat, price: d.price, image: d.src, self: false, sold: 0 };
}

// ---- 保存（IndexedDB、だめなら localStorage） ----
function idb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open(KEY, 1);
    q.onupgradeneeded = () => q.result.createObjectStore('kv');
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
let dbp = null;
export async function load() {
  try {
    dbp = dbp || idb();
    const db = await dbp;
    const v = await new Promise((res, rej) => {
      const r = db.transaction('kv').objectStore('kv').get('state');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (valid(v)) return v;
  } catch {}
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (valid(v)) return v;
  } catch {}
  return newState();
}
export async function save(s) {
  try {
    dbp = dbp || idb();
    const db = await dbp;
    await new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(structuredClone(s), 'state');
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
  } catch {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }
}
// 保存しているものをすべて消す（最初からやり直す）
export async function wipe() {
  try {
    dbp = dbp || idb();
    const db = await dbp;
    await new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').clear();
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
  } catch {}
  try { localStorage.removeItem(KEY); } catch {}
}
export const valid = s => !!s && s.v === 1 && typeof s.day === 'number' && s.cafe && Array.isArray(s.cafe.menu);
// 古いセーブに足りない項目を補う
export function upgrade(s) {
  s.shop ??= SHOP_START.map(x => ({ ...x, self: false }));
  s.bag ??= {};
  delete s.food;
  return s;
}

// ---- 倍率（ハラハラモード） ----
export const gainRate = s => (s.mode === 'harahara' ? HARAHARA.multiplier : 1);
function gain(s, key, n) { s.stats[key] = clamp(s.stats[key] + n * gainRate(s)); }
function earn(s, n) { const v = Math.round(n * gainRate(s)); s.coins += v; return v; }

export function canAct(s) {
  if (s.care.status === 'gone') return 'お別れした子とは、もう遊べません。';
  if (s.care.status === 'escaped') return 'いま、外へ出てしまっています。';
  return null;
}

// ---- お世話 ----
// ---- コンビニとバッグ ----
export const priceOf = item => item.price;
export function buyItem(s, id) {
  const it = s.shop.find(x => x.id === id);
  if (!it) throw Error('商品が見つかりません');
  if (it.kind === 'toy' && s.bag[id]) throw Error('もう持っています');
  if (s.coins < it.price) throw Error(`コインが足りません（${it.price}コイン）`);
  s.coins -= it.price;
  s.bag[id] = (s.bag[id] || 0) + 1;
  return it;
}
export function addShopItem(s, { kind, toy, name, image, self }) {
  if (s.shop.length >= 24) throw Error('商品は24個までです');
  const base = NEW_ITEM_PRICE[kind];
  const it = { id: 's-' + Date.now().toString(36), kind, name, image, self, price: self ? Math.round(base * SELF_DISCOUNT) : base, ...(kind === 'toy' ? { toy } : {}) };
  s.shop.push(it);
  return it;
}
export const bagItems = (s, kind) => s.shop.filter(x => x.kind === kind && s.bag[x.id] > 0);
export function useFood(s, id) {
  const no = canAct(s); if (no) throw Error(no);
  const it = s.shop.find(x => x.id === id);
  if (!it || !(s.bag[id] > 0)) throw Error('バッグに入っていません');
  s.bag[id]--;
  gain(s, 'hunger', 30);
  gain(s, 'bond', it.self ? 8 : 3);
  return it;
}
export function toyFor(s, id) {
  const no = canAct(s); if (no) throw Error(no);
  const it = s.shop.find(x => x.id === id);
  if (!it || !(s.bag[id] > 0)) throw Error('バッグに入っていません');
  return it;
}
export function pet(s) {
  if (canAct(s)) return false;
  gain(s, 'bond', 2); gain(s, 'mood', 2);
  s.care.lonely = 0;
  return true;
}
// ミニゲームの結果を受け取る（3.4）
export function applyPlay(s, result, toy) {
  if (!result.done) return;
  gain(s, 'mood', result.quality === 'good' ? 25 : 18);
  gain(s, 'bond', toy?.self ? 9 : 5);
  s.stats.hunger = clamp(s.stats.hunger - 6);
  s.care.lonely = 0;
}
export function applyBath(s, result) {
  if (!result.done) return;
  s.care.dirty = 0;
  if (s.care.status === 'sick') { s.care.status = 'ok'; s.care.sick = 0; }
  gain(s, 'mood', result.quality === 'good' ? 10 : 5);
  gain(s, 'bond', result.quality === 'good' ? 6 : 4);
}

export function nextDay(s) {
  s.day++;
  s.stats.hunger = clamp(s.stats.hunger - 15);
  s.stats.mood = clamp(s.stats.mood - 8);
  s.mode = s.modeNext;
  if (s.care.status === 'escaped') s.care.status = 'ok';
}

// 遊んでいる間だけ進む時計（3.5）
export function tick(s, dt) {
  if (!s.started || s.care.status === 'gone') return null;
  const c = s.care;
  c.dirty += dt;
  c.lonely += dt;
  s.stats.hunger = clamp(s.stats.hunger - dt * 0.05);
  if (s.mode !== 'harahara') return c.dirty > HARAHARA.dirtyToSick && Math.floor(c.dirty) % 60 === 0 ? 'dirty-hint' : null;
  if (c.status === 'ok' && c.dirty >= HARAHARA.dirtyToSick) { c.status = 'sick'; c.sick = 0; return 'sick'; }
  if (c.status === 'sick') {
    c.sick += dt;
    if (c.sick >= HARAHARA.sickToGone) { farewell(s); return 'gone'; }
  }
  if (c.status === 'ok' && c.lonely >= HARAHARA.lonelyToEscape && (s.stats.bond < 40 || s.stats.mood < 30)) { c.status = 'escaped'; return 'escaped'; }
  return null;
}
export function bringBack(s) { s.care.status = 'ok'; s.care.lonely = 0; gain(s, 'bond', 3); }

function farewell(s) {
  s.care.status = 'gone';
  s.memories.push({ kind: 'farewell', name: s.pet.name, image: s.pet.image, day: s.day });
}
export function startOver(s) {
  const keep = { shop: s.shop, bag: s.bag, coins: s.coins, house: s.house, owned: s.owned, cafe: s.cafe, memories: s.memories, served: s.served, sound: s.sound, volume: s.volume, day: s.day };
  Object.assign(s, newState(), keep);
}

// ---- 相棒 ----
export function createPet(s, { name, personality, image, self }) {
  s.pet = { name, personality, image, self, createdDay: s.day };
  s.started = true;
}
// 名前と性格は固定。絵は手直しのみ。はじめの3日間だけ白紙から描き直せる（3.6）
export const canRedrawFresh = s => s.day - (s.pet?.createdDay ?? s.day) < 3;
export function touchUpPet(s, image) {
  s.memories.push({ kind: 'before', name: s.pet.name, image: s.pet.image, day: s.day });
  s.pet.image = image;
  s.pet.self = true;
}

// ---- カフェ ----
export const guest = s => GUESTS[s.cafe.guestNo % GUESTS.length];
export const matches = s => s.cafe.menu.filter(m => m.cat === guest(s).wants);
export function pickDish(s, id) {
  const m = s.cafe.menu.find(x => x.id === id);
  if (!m) throw Error('メニューが見つかりません');
  if (m.cat !== guest(s).wants) throw Error('注文とちがう種類です');
  s.cafe.picked = id;
}
export function applyCook(s, result) {
  if (!result.done) return;
  s.cafe.step = 'made';
  s.cafe.quality = result.quality;
}
export function serveDish(s) {
  if (s.cafe.step !== 'made') throw Error('先に料理を作ってください');
  const m = s.cafe.menu.find(x => x.id === s.cafe.picked);
  const first = m.sold === 0 && m.self;
  const base = Math.round(m.price * CAFE_LEVELS[s.cafe.level].bonus);
  // 出来ばえが「よい」なら2割のチップ（報酬の3段：完了／出来ばえ／自作）
  const tip = s.cafe.quality === 'good' ? Math.round(base * 0.2) : 0;
  const total = earn(s, base + tip + (first ? 80 : 0));
  m.sold++;
  s.served++;
  s.cafe.step = 'served';
  gain(s, 'bond', 1);
  return { total, tip, first, self: m.self, dish: m, quality: s.cafe.quality || 'normal' };
}
export function nextGuest(s) {
  s.cafe.guestNo++;
  s.cafe.step = 'order';
  s.cafe.picked = null;
}
export function addDish(s, { name, cat, image, self, price }) {
  if (s.cafe.menu.length >= 12) throw Error('メニューは12品までです');
  const m = { id: 'm-' + Date.now().toString(36), name, cat, price, image, self, sold: 0 };
  s.cafe.menu.push(m);
  return m;
}
export function expandCafe(s) {
  const next = CAFE_LEVELS[s.cafe.level + 1];
  if (!next) throw Error('これ以上は広げられません');
  if (s.coins < next.price) throw Error(`コインが足りません（${next.price}コイン）`);
  s.coins -= next.price;
  s.cafe.level++;
}

// ---- おうち ----
export function moveHouse(s, id) {
  const h = HOUSES.find(x => x.id === id);
  if (!s.owned.includes(id)) {
    if (s.coins < h.price) throw Error(`コインが足りません（あと${h.price - s.coins}コイン）`);
    s.coins -= h.price;
    s.owned.push(id);
  }
  s.house = id;
}
