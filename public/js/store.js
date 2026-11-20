// ゲームの状態とルール。画面描画からは切り離す（6章）。
import { PEN_DISHES, STARTER_DISHES, GUESTS, HOUSES, CAFE_LEVELS, HARAHARA, SHOP_START, NEW_ITEM_PRICE, SELF_DISCOUNT, FEELING, PEN_COMPANIONS, FACE_SLOTS, FEELING_FACE } from './data.js';

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
    posters: [],          // 描いたポスター [{ id, image, self, drawnDay, drawnAt, pen? }]（設計書 3.9）
    poster: null,         // 飾っているポスターの id（なければ null）
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
    memories: [],         // 手直し前の絵・お別れした子（スケッチブックに並ぶ。名前は互換のため memories のまま）
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
  // 以前のセーブは、飾っていたポスターの絵そのものを poster に持っていた → 一覧の1枚目に移して飾る（設計書 3.9）
  s.posters ??= [];
  if (s.poster && typeof s.poster === 'object') {
    const old = { id: 'p-old', image: s.poster.image, self: !!s.poster.self, drawnDay: s.poster.drawnDay ?? null };
    s.posters.unshift(old); s.poster = old.id;
  }
  s.bag ??= {};
  delete s.food;
  return s;
}

// ---- 上限（いっぱいのときは、描く前に止める。描き終わってから入らない、をなくす） ----
// 上限の数と、いっぱいのときの扱いは未決（設計書 8章）
export const MENU_MAX = 12, SHOP_MAX = 24;
export const menuFull = s => s.cafe.menu.length >= MENU_MAX;
export const shopFull = s => s.shop.length >= SHOP_MAX;

// ---- 倍率（ハラハラモード） ----
export const gainRate = s => (s.mode === 'harahara' ? HARAHARA.multiplier : 1);
function gain(s, key, n) { s.stats[key] = clamp(s.stats[key] + n * gainRate(s)); }
function earn(s, n) { const v = Math.round(n * gainRate(s)); s.coins += v; return v; }

export function canAct(s) {
  if (s.care.status === 'gone') return 'お別れした子とは、もう遊べません。';
  if (s.care.status === 'escaped') return 'いま、外へ出てしまっています。';
  return null;
}

// ---- 相棒の気持ち（設計書 3.8）----
// 気持ちは毎回いまの状態から決め、セーブには入れない。「うれしい」の時刻だけ、セーブの外に覚えておく
const joyAt = new WeakMap();
const cheer = s => joyAt.set(s, Date.now());
// しょんぼりの理由（NEEDS のキー）。ハラハラモードのさみしさは「すねる」に回すので入れない
export function needs(s) {
  const c = s.care, list = [];
  if (c.status === 'sick') list.push('sick');
  if (s.stats.hunger < FEELING.hungry) list.push('hunger');
  if (c.dirty >= FEELING.dirty) list.push('dirty');
  if (c.lonely >= FEELING.lonely && s.mode !== 'harahara') list.push('lonely');
  return list;
}
// いまの気持ち（FEELINGS のキー）。相棒がそこにいないとき（逃げた・お別れした）は null
export function feeling(s, now = Date.now()) {
  if (!s.started || !s.pet || s.care.status === 'gone' || s.care.status === 'escaped') return null;
  if (now - (joyAt.get(s) ?? -Infinity) < FEELING.happySec * 1000) return 'happy';
  if (s.mode === 'harahara' && s.care.lonely >= FEELING.lonely) return 'sulky';
  if (needs(s).length) return 'down';
  if (s.stats.mood >= FEELING.cheerful) return 'cheerful';
  return 'normal';
}

// 表情の差分（3.8）。いまの気持ちで見せる絵（still）と、話している間に交互に出す絵（talk。なければ null で、揺れで代わりにする）
// 魔法のペンの子は、一覧の行の faces から引く（セーブの絵の場所で探す。絵ファイルの名前は変えない決まり。6.1）
// 自分で描いた子の差分は、いずれ pet.faces に入る
export function petFaces(s, f) {
  const p = s.pet;
  if (!p) return { still: null, talk: null };
  const faces = p.faces || PEN_COMPANIONS.find(c => c.src === p.image)?.faces || {};
  const find = slot => slot && (faces[slot] ? slot : FACE_SLOTS[slot].backup.find(b => faces[b])) || null;
  const used = find(FEELING_FACE[f]);
  const talkSlot = used === null ? find('talk') : used === 'smile' ? find('smileTalk') : null;
  return { still: used ? faces[used] : p.image, talk: talkSlot ? faces[talkSlot] : null };
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
  if (shopFull(s)) throw Error(`商品は${SHOP_MAX}個までです`);
  const base = NEW_ITEM_PRICE[kind];
  const it = { id: 's-' + Date.now().toString(36), kind, name, image, self, drawnDay: s.day, drawnAt: Date.now(), price: self ? Math.round(base * SELF_DISCOUNT) : base, ...(kind === 'toy' ? { toy } : {}) };
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
  cheer(s);
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
  cheer(s);
  return true;
}
// ミニゲームの結果を受け取る（3.4）
export function applyPlay(s, result, toy) {
  if (!result.done) return;
  gain(s, 'mood', result.quality === 'good' ? 25 : 18);
  gain(s, 'bond', toy?.self ? 9 : 5);
  s.stats.hunger = clamp(s.stats.hunger - 6);
  s.care.lonely = 0;
  cheer(s);
}
export function applyBath(s, result) {
  if (!result.done) return;
  s.care.dirty = 0;
  if (s.care.status === 'sick') { s.care.status = 'ok'; s.care.sick = 0; }
  gain(s, 'mood', result.quality === 'good' ? 10 : 5);
  gain(s, 'bond', result.quality === 'good' ? 6 : 4);
  cheer(s);
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
  s.memories.push({ kind: 'farewell', name: s.pet.name, image: s.pet.image, self: s.pet.self, day: s.day, drawnAt: s.pet.drawnAt ?? null });
}
export function startOver(s) {
  const keep = { shop: s.shop, bag: s.bag, coins: s.coins, house: s.house, owned: s.owned, cafe: s.cafe, memories: s.memories, served: s.served, sound: s.sound, volume: s.volume, day: s.day };
  Object.assign(s, newState(), keep);
}

// ---- 相棒 ----
export function createPet(s, { name, personality, image, self }) {
  s.pet = { name, personality, image, self, createdDay: s.day, drawnDay: s.day, drawnAt: Date.now() };
  s.started = true;
}
// 名前と性格は固定。絵は手直しのみ。はじめの3日間だけ白紙から描き直せる（3.6）
export const canRedrawFresh = s => s.day - (s.pet?.createdDay ?? s.day) < 3;
// 相棒の絵を替える。手直し（自分で描いた子に描き足す）と、はじめの3日間の描き直し（自分で描く／魔法のペン）の両方
export function touchUpPet(s, image, self = true) {
  s.memories.push({ kind: 'before', name: s.pet.name, image: s.pet.image, self: s.pet.self, day: s.day, drawnAt: s.pet.drawnAt ?? null }); // 描いた時刻は前の絵のまま引き継ぐ
  s.pet.image = image;
  s.pet.self = self;
  s.pet.drawnDay = s.day;
  s.pet.drawnAt = Date.now();
}
// 手直し（描き足し）できるのは、自分で描いた子だけ（設計書 2.7）
export const canTouchUp = s => !!s.pet?.self;

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
  if (menuFull(s)) throw Error(`メニューは${MENU_MAX}品までです`);
  const m = { id: 'm-' + Date.now().toString(36), name, cat, price, image, self, drawnDay: s.day, sold: 0 };
  s.cafe.menu.push(m);
  m.drawnAt = Date.now(); // 描いた時刻（スケッチブックの並べ替え用：設計書 2.6）
  return m;
}
// ---- ポスター（設計書 3.9。カフェのメニューと同じ扱い：12枚まで、いっぱいなら足せない） ----
export const POSTER_MAX = 12;
export const posterFull = s => s.posters.length >= POSTER_MAX;
export const currentPoster = s => s.posters.find(p => p.id === s.poster) ?? null;
// 描いたポスターを一覧に足して飾る。魔法のペンの同じ絵を2回選んだときは、前の1枚を飾り直す
export function addPoster(s, { image, self, pen = null }) {
  const same = !self && pen && s.posters.find(p => p.pen === pen);
  if (same) { s.poster = same.id; return same; }
  if (posterFull(s)) throw Error(`ポスターは${POSTER_MAX}枚までです`);
  const p = { id: 'p-' + Date.now().toString(36), image, self, drawnDay: s.day, drawnAt: Date.now(), ...(pen ? { pen } : {}) };
  s.posters.push(p);
  s.poster = p.id;
  return p;
}
// 飾り替える。null ならはずす
export function hangPoster(s, id) {
  if (id != null && !s.posters.some(p => p.id === id)) throw Error('ポスターが見つかりません');
  s.poster = id;
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

// ---- スケッチブック（設計書 2.6） ----
// これまでの絵を、セーブの中から集める（絵を二重に持たない）。
// 並べ方は「描いた時刻（drawnAt）の古い順」だけ。種類や、いまの相棒かどうかで並びを変えない。
// 描いた時刻の記録がない絵（記録を始める前の絵）は、いちばん古い側にまとめる（その中は描いた日の古い順）。
// 並ぶのは：いまの相棒・描き直す前の相棒・お別れした子・自分で足した料理と商品・ポスター
// はじめからある料理と商品は、遊ぶ人が描いたものではないので並べない（描いた日を持たないもので見分ける）
// 保存・共有できるのは自分で描いた絵だけ（self が true のもの。わからないものはできない：設計書 2.7）
export function sketchbook(s) {
  const list = [];
  const add = (kind, it, day, note = '') => list.push({ kind, name: it.name || '', image: it.image, self: it.self === true, day: day ?? null, note, at: it.drawnAt ?? null });
  if (s.pet) add('pet', s.pet, s.pet.drawnDay ?? s.pet.createdDay);
  for (const m of s.memories) add(m.kind === 'farewell' ? 'farewell' : 'before', m, m.day);
  for (const m of s.cafe.menu) if (m.drawnDay != null || m.self) add('dish', m, m.drawnDay);
  for (const it of s.shop) if (it.drawnDay != null || it.self) add(it.kind === 'toy' ? 'toy' : 'food', it, it.drawnDay);
  for (const p of s.posters) add('poster', { ...p, name: 'ポスター' }, p.drawnDay, p.id === s.poster ? 'かざっている' : ''); // 飾っている1枚は種類の欄に添える
  const key = x => [x.at == null ? 0 : 1, x.at ?? x.day ?? -1]; // 時刻がないものが先（古い側）
  return list.map((x, i) => ({ ...x, i }))
    .sort((a, b) => { const [ka, va] = key(a), [kb, vb] = key(b); return ka - kb || va - vb || a.i - b.i; })
    .map(({ i, at, ...x }) => x);
}
export const SKETCH_KINDS = { pet: 'いまの相棒', before: '描き直す前の相棒', farewell: 'お別れした子', dish: '料理', food: 'ごはん', toy: 'おもちゃ', poster: 'ポスター' };
