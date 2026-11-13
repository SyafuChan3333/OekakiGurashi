import * as S from './store.js';
import { PERSONALITIES, PEN_COMPANIONS, PEN_DISHES, PEN_FOODS, PEN_POSTERS, PEN_TOYS, TOY_TYPES, NEW_ITEM_PRICE, SELF_DISCOUNT, CATEGORIES, HOUSES, CAFE_LEVELS, HARAHARA } from './data.js';
import { World } from './scene.js';
import { $, esc, icon, modal, closeModal, modalOpen, toast, say, placeBubbles } from './ui.js';
import { drawFlow, openEditor } from './draw.js';
import { runMinigame } from './minigames.js';
import { installInputGuards } from './input.js';
import { initAudio, setScene, play } from './audio.js';
import { splashReady } from './splash.js';
import { DEBUG } from './config.js';

let state, world, page = 'room', houseView = 0;
const personality = () => PERSONALITIES.find(p => p.id === state.pet?.personality) || PERSONALITIES[0];
const house = () => HOUSES.find(h => h.id === state.house) || HOUSES[0];
const isPhone = () => matchMedia('(max-width: 640px)').matches;
const persist = () => S.save(state);

// ---- 相棒のセリフ（短く、くだけた話し言葉） ----
const LINES = {
  tap: { playful: ['なになに？', 'あそぼ！', 'えへへ'], curious: ['ん？', 'それなに？', 'ふーん'], sleepy: ['……ん', 'ねむい……', 'ふぁ'], clingy: ['いた！', 'そばにいて', 'すき'] },
  stroke: ['ふにゃ〜', 'もっと', 'きもちいい', 'ごろごろ'],
  feed: ['いただきます！', 'もぐもぐ', 'おいしい'],
  feedSelf: ['これ、きみが描いたの？ おいしい！', 'いつものより、ずっとおいしい', 'きみのごはん、だいすき'],
  play: ['もう一回！', 'たのしかった！', 'まてまて〜'],
  bath: ['さっぱり！', 'ぴかぴか'],
  morning: ['おはよ', 'あさだー', 'きょうもよろしく'],
  hungry: 'おなか、すいたかも', dirty: 'ちょっと、ベタベタする', sick: 'からだが、だるい……',
};
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---- 起動 ----
async function init() {
  installInputGuards();
  state = S.upgrade(await S.load());
  if (state.started && !state.pet) state.started = false;
  initAudio(() => ({ sound: state.sound, volume: state.volume }));
  world = new World($('#world'), { onPet: petTouched, onAnchor: placeBubbles });
  $('#places').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b) go(b.dataset.page); });
  $('#settings').addEventListener('click', settings);
  $('#next-guest').addEventListener('click', () => act('next').catch(err => toast(err.message)));
  $('#memories-btn').addEventListener('click', () => { play('tap'); memories(); });
  $('#status').addEventListener('click', e => { if (e.target.closest('#pet-card')) { play('tap'); petMenu(); } });
  $('#actions').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) act(b.dataset.a).catch(err => toast(err.message)); });
  $('#alert').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a).catch(err => toast(err.message)); });
  matchMedia('(max-width: 640px)').addEventListener('change', renderHUD);
  settingsInputs();
  go('room');
  await splashReady(state.started ? state.pet?.image : null);
  setInterval(loop, 1000); // 時間が進むのは、タップしてはじめてから
  if (!state.started) startFlow();
}

function go(p) {
  page = p;
  if (p === 'room') { world.showRoom(house(), state.poster?.image); setScene('room'); }
  if (p === 'cafe') { world.showCafe(state.cafe.level); world.setGuest(guestPic()); setScene('cafe'); syncCafe(); say('guest', esc(S.guest(state).ask), 0); }
  if (p === 'shop') { world.showShop(); world.setGuest('assets/pen/cat7.png'); setScene('room'); say('guest', 'いらっしゃいませ〜', 2500); }
  if (p === 'house') { houseView = HOUSES.findIndex(h => h.id === state.house); world.showRoom(HOUSES[houseView], state.poster?.image); }
  if (p !== 'cafe' && p !== 'shop') say('guest', '');
  say('pet', '');
  syncPet();
  renderHUD();
}
const guestPic = () => `assets/pen/cat${S.guest(state).pic}.png`;

function syncPet() {
  const gone = state.care.status === 'gone' || state.care.status === 'escaped';
  world.setPet(state.pet?.image || null, personality());
  world.hidePet(gone || !state.started);
}
function syncCafe() {
  const c = state.cafe, dish = c.menu.find(m => m.id === c.picked);
  if (c.step === 'order') { world.setDish(null); }
  if (c.step === 'made') world.setDish(dish.image, 'pet');
  if (c.step === 'served') world.setDish(dish.image, 'table');
}

// ---- HUD ----
const gauge = (label, v, cls) => `<span class="g"><small>${label}</small><i class="bar ${cls}"><b style="width:${v}%"></b></i></span>`;
function renderHUD() {
  $('#coins').textContent = state.coins.toLocaleString();
  $('#day').textContent = `${state.day}日目`;
  $('#mode-chip').hidden = state.mode !== 'harahara';
  document.querySelectorAll('#places [data-page]').forEach(b => b.setAttribute('aria-current', b.dataset.page === (page === 'house' ? 'room' : page) ? 'page' : 'false'));
  const st = $('#status');
  if (!state.started) { st.innerHTML = ''; }
  else if (page === 'room') {
    const s = state.stats;
    st.innerHTML = `<button class="card pet-card" id="pet-card" aria-label="${esc(state.pet.name)}のメニュー"><img src="${state.pet.image}" alt="" draggable="false"><div><b>${esc(state.pet.name)}</b><div class="gs">${gauge('おなか', s.hunger, 'h')}${gauge('ごきげん', s.mood, 'm')}${gauge('なかよし', s.bond, 'b')}</div></div></button>`;
  } else if (page === 'cafe') {
    const g = S.guest(state), d = state.cafe.menu.find(m => m.id === state.cafe.picked);
    st.innerHTML = `<div class="card ticket"><small>ご注文 · ${CAFE_LEVELS[state.cafe.level].name}</small><b>${esc(g.name)} ／ ${CATEGORIES[g.wants].name}</b><small>${d ? '選んだ料理：' + esc(d.name) : 'メニューから選んでね'}</small></div>`;
  } else if (page === 'shop') {
    const f = S.bagItems(state, 'food').reduce((n, x) => n + state.bag[x.id], 0), t = S.bagItems(state, 'toy').length;
    st.innerHTML = `<div class="card ticket"><small>コンビニ</small><b>バッグ：ごはん ${f}こ・おもちゃ ${t}こ</b><small>自分で描いた商品は${Math.round((1 - SELF_DISCOUNT) * 100)}%引き</small></div>`;
  } else if (page === 'house') {
    const h = HOUSES[houseView], own = state.owned.includes(h.id);
    st.innerHTML = `<div class="card ticket"><small>引っ越し先を見る（${houseView + 1}/${HOUSES.length}）</small><b>${esc(h.name)}</b><small>${state.house === h.id ? 'いま住んでいる家' : own ? '購入ずみ' : h.price.toLocaleString() + 'コイン'}</small></div>`;
  }
  renderAlert();
  renderActions();
}

function renderAlert() {
  const a = $('#alert'), c = state.care;
  let html = '';
  if (!state.started) html = '';
  else if (c.status === 'sick') html = `<span>${esc(state.pet.name)}の具合が悪い。お風呂できれいにしよう（あと${Math.max(0, Math.ceil(HARAHARA.sickToGone - c.sick))}秒）</span><button class="btn" data-a="bath">お風呂</button>`;
  else if (c.status === 'escaped') html = `<span>${esc(state.pet.name)}が外へ出てしまった</span><button class="btn" data-a="chase">迎えに行く</button>`;
  else if (c.status === 'gone') html = `<span>${esc(state.pet.name)}とお別れしました</span><button class="btn" data-a="restart">新しい子を迎える</button>`;
  a.innerHTML = html;
  a.hidden = !html;
}

// アイコンの丸の色（ボタンごとに色を分ける）
const A = {
  bag: ['bag', 'バッグ', '#f1c45a'], bath: ['bath', 'お風呂', '#8fc6dd'], sleep: ['moon', 'おやすみ', '#b9a8dc'], remodel: ['sofa', 'お部屋', '#a6d08f'], store: ['shop', 'お店', '#e9c58a'],
  buy: ['cart', '買う', '#f0a07e'], newitem: ['pen', '新しく描く', '#f2b3c8'],
  feed: ['bowl', 'ごはん'], play: ['ball', 'あそぶ'], draw: ['pen', '描く'],
  menu: ['book', 'メニュー', '#f0a07e'], cook: ['pot', '作る', '#e8826a'], serve: ['tray', '運ぶ', '#f1c45a'], next: ['next', 'つぎの人', '#a6d08f'],
  prev: ['back', 'まえ', '#d9d0c0'], fwd: ['next', 'つぎ', '#d9d0c0'], live: ['house', 'ここに住む', '#a6d08f'], leave: ['close', 'もどる', '#d9d0c0'], more: ['more', 'その他', '#e6dfd2'],
};
function actionList() {
  if (page === 'room') return ['bag', 'bath', 'sleep', 'remodel'];
  if (page === 'shop') return ['buy', 'newitem'];
  if (page === 'cafe') {
    const c = state.cafe;
    return ['menu', 'cook', 'serve', 'store'];
  }
  return ['prev', 'fwd', 'live', 'leave'];
}
function renderActions() {
  if (!state.started) { $('#actions').innerHTML = ''; return; }
  // 「その他」ボタンは作らない。どの場面もボタンは4つまで（5.1）
  const shown = actionList();
  const blocked = !!S.canAct(state);
  const c = state.cafe;
  const served = page === 'cafe' && c.step === 'served';
  const off = a => (blocked && ['bag', 'menu', 'cook', 'serve'].includes(a)) || (served && ['menu', 'cook', 'serve'].includes(a)) || (a === 'cook' && (!c.picked || c.step !== 'order')) || (a === 'serve' && c.step !== 'made');
  const primary = a => (a === 'newitem') || (a === 'cook' && c.picked && c.step === 'order') || (a === 'serve' && c.step === 'made') || a === 'next' || (a === 'live');
  // 提供が終わったら、下のボタンとは別に「つぎのお客さま」を出す
  $('#next-guest').hidden = !served;
  $('#actions').innerHTML = shown.map(a => `<button class="act ${primary(a) ? 'primary' : ''}" data-a="${a}" ${off(a) ? 'disabled' : ''}><span class="ic" style="--c:${A[a][2] || '#e6dfd2'}">${icon(A[a][0], 24)}</span><span>${A[a][1]}</span></button>`).join('');
}

function floatCoins(n) {
  const f = document.createElement('div');
  f.className = 'float';
  f.textContent = `+${n}`;
  $('#hud').appendChild(f);
  setTimeout(() => f.remove(), 1400);
}

// ---- 操作 ----
let petCool = 0;
function petTouched(kind) {
  if (!state.started || S.canAct(state) || modalOpen()) return;
  const now = performance.now();
  if (now < petCool) return;
  petCool = now + 500;
  if (kind === 'stroke') { S.pet(state); world.happy(); play('happy'); say('pet', pick(LINES.stroke)); }
  else { play('meow'); say('pet', pick(LINES.tap[personality().id] || LINES.tap.playful)); }
  renderHUD();
}

async function act(a) {
  play('tap');
  if (a === 'store') return expandMenu();
  if (a === 'bag') return bagMenu();
  if (a === 'remodel') return remodelMenu();
  if (a === 'buy') return shopMenu();
  if (a === 'newitem') return newItem();
  if (a === 'touchup') return touchUp();
  if (a === 'bath') { const r = await runMinigame('bath', { petName: state.pet.name, petImage: state.pet.image }); S.applyBath(state, r); if (r.done) { world.happy(); say('pet', r.quality === 'good' ? 'ふわっふわ！ 気持ちよかった〜' : pick(LINES.bath)); } syncPet(); }
  if (a === 'sleep') return sleep();
  if (a === 'chase') return chase();
  if (a === 'restart') { S.startOver(state); await persist(); go('room'); return startFlow(); }
  if (a === 'menu') return cafeMenu();
  if (a === 'cook') {
    const dish = state.cafe.menu.find(m => m.id === state.cafe.picked);
    const r = await runMinigame('cook', { dish });
    S.applyCook(state, r);
    if (r.done) { syncCafe(); say('pet', '運ぶね！'); }
  }
  if (a === 'serve') {
    const r = S.serveDish(state);
    world.walkPetTo(-0.55, 0.15);
    setTimeout(() => {
      world.setDish(r.dish.image, 'table');
      const g = S.guest(state);
      say('guest', esc(r.self ? g.special : r.quality === 'poor' ? g.poor : g.thanks), 0);
      floatCoins(r.total);
      play('done');
      if (r.first) toast('自分で描いた新作！ ボーナス +80');
      else if (r.tip) toast(`じょうずにできたので、チップ +${r.tip}`);
      world.walkPetTo(-0.9, 0.7);
    }, 900);
  }
  if (a === 'next') { S.nextGuest(state); world.setGuest(guestPic()); syncCafe(); say('guest', esc(S.guest(state).ask), 0); }
  if (a === 'prev' || a === 'fwd') {
    houseView = (houseView + (a === 'fwd' ? 1 : -1) + HOUSES.length) % HOUSES.length;
    world.showRoom(HOUSES[houseView], state.poster?.image); syncPet();
  }
  if (a === 'leave') return go('room');
  if (a === 'live') {
    const h = HOUSES[houseView];
    S.moveHouse(state, h.id);
    toast(`${h.name}に住むことにしました`);
    await persist();
    return go('room');
  }
  await persist();
  renderHUD();
}

// ---- ステータス欄を押したときのメニュー ----
function petMenu() {
  if (!state.started || state.care.status === 'gone') return;
  const s = state.stats, p = personality();
  modal(`<h2>${esc(state.pet.name)}</h2>
    <div class="paper small"><img src="${state.pet.image}" alt="" draggable="false"></div>
    <dl class="confirm"><dt>性格</dt><dd>${esc(p.name)}</dd><dt>おなか</dt><dd>${s.hunger}</dd><dt>ごきげん</dt><dd>${s.mood}</dd><dt>なかよし</dt><dd>${s.bond}</dd></dl>
    <button class="btn wide" data-act="touchup">${icon('pen', 20)} ${esc(state.pet.name)}を手直し</button>`, {
    onAct: a => { if (a === 'touchup') { closeModal(); touchUp(); } },
  });
}

// ---- 相棒の手直し（3日目までは白紙から描き直せる） ----
async function touchUp() {
  let img;
  if (S.canRedrawFresh(state)) {
    const r = await drawFlow({ title: `${state.pet.name}を描き直す`, gallery: PEN_COMPANIONS, base: state.pet.image, note: '3日目までは白紙から描き直せます。それ以降は、いまの絵に描き足す手直しになります。' });
    img = r?.image; if (r) state.pet.self = r.self;
  } else img = await openEditor({ title: `${state.pet.name}を手直し`, base: state.pet.image });
  if (img) { S.touchUpPet(state, img); syncPet(); world.happy(); say('pet', 'どう？ にあう？'); await persist(); renderHUD(); }
}

// ---- 模様替え（ポスターと引っ越しをまとめる） ----
function remodelMenu() {
  modal(`<h2>模様替え</h2><div class="list">
    <button class="btn wide" data-act="poster">${icon('frame', 20)} ポスターを描く</button>
    <button class="btn wide" data-act="move">${icon('house', 20)} 引っ越し先を見る</button>
  </div>`, {
    onAct: async a => {
      if (a === 'close') return;
      closeModal();
      if (a === 'move') return go('house');
      if (a === 'poster') {
        const r = await drawFlow({ title: 'おへやのポスター', gallery: PEN_POSTERS });
        if (r) { state.poster = { image: r.image, self: r.self }; world.setPoster(r.image); if (r.self) say('pet', 'きみの絵だ！ かざってくれたんだ'); await persist(); }
      }
    },
  });
}

// ---- バッグ ----
const itemCard = (it, extra, act) => `<button class="pen-item" data-act="${act}" data-id="${it.id}"><img src="${it.image}" alt="" draggable="false"><span>${esc(it.name)}${it.self ? ' ✎' : ''}<br><small>${extra}</small></span></button>`;
function bagMenu() {
  const foods = S.bagItems(state, 'food'), toys = S.bagItems(state, 'toy');
  modal(`<h2>バッグ</h2>
    <h3 class="sub">ごはん</h3>${foods.length ? `<div class="pen-grid">${foods.map(it => itemCard(it, `${state.bag[it.id]}こ`, 'food')).join('')}</div>` : '<p class="note">ごはんがありません。コンビニで買えます。</p>'}
    <h3 class="sub">おもちゃ</h3>${toys.length ? `<div class="pen-grid">${toys.map(it => itemCard(it, TOY_TYPES[it.toy].name, 'toy')).join('')}</div>` : '<p class="note">おもちゃがありません。コンビニで買えます。</p>'}
    ${!foods.length || !toys.length ? '<button class="btn wide" data-act="shop">コンビニへ行く</button>' : ''}`, {
    wide: true,
    onAct: async (a, el) => {
      if (a === 'close') return;
      if (a === 'shop') { closeModal(); return go('shop'); }
      if (a === 'food') {
        const it = S.useFood(state, el.dataset.id);
        closeModal();
        world.setFood(it.image); world.happy(); play('happy');
        say('pet', pick(it.self ? LINES.feedSelf : LINES.feed));
      }
      if (a === 'toy') {
        const it = S.toyFor(state, el.dataset.id);
        closeModal();
        const r = await runMinigame(it.toy, { petName: state.pet.name, petImage: state.pet.image, toy: it });
        S.applyPlay(state, r, it);
        if (r.done) { world.happy(); say('pet', it.self ? 'きみが作ったおもちゃ、いちばん好き！' : r.quality === 'good' ? 'たのしかった〜！ またあそぼ！' : pick(LINES.play)); }
      }
      await persist(); renderHUD();
    },
  });
}

// ---- コンビニ ----
function shopMenu() {
  const sec = kind => state.shop.filter(x => x.kind === kind).map(it => {
    const owned = kind === 'toy' && state.bag[it.id] > 0;
    return itemCard(it, owned ? '持っている' : `${it.price}コイン${kind === 'food' && state.bag[it.id] ? `（${state.bag[it.id]}こ）` : ''}`, owned ? 'owned' : 'buy');
  }).join('');
  modal(`<h2>コンビニ</h2><p class="note">おさいふ：${state.coins.toLocaleString()}コイン</p>
    <h3 class="sub">ごはん</h3><div class="pen-grid">${sec('food')}</div>
    <h3 class="sub">おもちゃ</h3><div class="pen-grid">${sec('toy')}</div>`, {
    wide: true,
    onAct: async (a, el) => {
      if (a === 'owned') return toast('もう持っています。バッグから遊べます');
      if (a !== 'buy') return;
      const it = S.buyItem(state, el.dataset.id);
      play('done'); toast(`${it.name}を買いました`);
      say('guest', 'ありがとうございます〜', 2000);
      await persist(); renderHUD(); shopMenu();
    },
  });
}
function newItem() {
  const disc = Math.round((1 - SELF_DISCOUNT) * 100);
  modal(`<h2>新しい商品を描く</h2><p class="note">描いた商品はお店に並びます。自分で描くと${disc}%引きで買えます。</p>
    <div class="list">
      <button class="btn wide pers" data-act="food"><b>ごはん</b><small>${NEW_ITEM_PRICE.food}コイン（自分で描くと${Math.round(NEW_ITEM_PRICE.food * SELF_DISCOUNT)}コイン）</small></button>
      ${Object.entries(TOY_TYPES).map(([k, t]) => `<button class="btn wide pers" data-act="toy" data-id="${k}"><b>おもちゃ：${t.name}</b><small>${t.note}あそび。${NEW_ITEM_PRICE.toy}コイン（自分で描くと${Math.round(NEW_ITEM_PRICE.toy * SELF_DISCOUNT)}コイン）</small></button>`).join('')}
    </div>`, {
    onAct: async (a, el) => {
      if (a !== 'food' && a !== 'toy') return;
      closeModal();
      const kind = a, toy = el.dataset.id;
      const label = kind === 'food' ? 'ごはん' : TOY_TYPES[toy].name;
      const r = await drawFlow({ title: `新しい${label}`, gallery: kind === 'food' ? PEN_FOODS : PEN_TOYS[toy] });
      if (!r) return;
      modal(`<h2>商品の名前</h2><div class="paper small"><img src="${r.image}" alt="" draggable="false"></div>
        <label class="field">名前<input id="item-name" maxlength="14" value="${esc(r.self ? '' : r.name || '')}" placeholder="例：にくきゅうクッキー"></label>
        <button class="btn primary wide" data-act="ok">お店に並べる</button>`, {
        closable: false,
        onAct: async b => {
          if (b !== 'ok') return;
          const it = S.addShopItem(state, { kind, toy, name: $('#item-name').value.trim() || `手描きの${label}`, image: r.image, self: r.self });
          closeModal();
          toast(`${it.name}がお店に並びました（${it.price}コイン）`);
          say('guest', r.self ? 'すてきな絵！ さっそく並べますね' : '並べておきますね', 2500);
          await persist(); renderHUD();
        },
      });
    },
  });
}

function sleep() {
  modal(`<h2>今日はおやすみする？</h2><p class="note">次の日になります。${state.modeNext !== state.mode ? `明日から${state.modeNext === 'harahara' ? 'ハラハラモード' : 'ふつうのモード'}になります。` : ''}</p><button class="btn primary wide" data-act="ok">おやすみ</button>`, {
    onAct: async a => {
      if (a !== 'ok') return;
      closeModal();
      document.body.classList.add('night');
      setTimeout(async () => {
        S.nextDay(state); await persist();
        document.body.classList.remove('night');
        syncPet(); renderHUD();
        if (state.care.status !== 'gone') say('pet', pick(LINES.morning));
      }, 900);
    },
  });
}

async function chase() {
  const r = await runMinigame('chase', { petName: state.pet.name, petImage: state.pet.image });
  if (!r.done) return;
  S.bringBack(state); syncPet(); world.happy();
  say('pet', r.quality === 'good' ? '見つけてくれた！ ただいま' : 'ごめんね、さみしかった');
  await persist(); renderHUD();
}

function memories() {
  const m = state.memories;
  modal(`<h2>思い出</h2>${m.length ? `<div class="pen-grid">${m.map(x => `<div class="pen-item"><img src="${x.image}" alt="" draggable="false"><span>${esc(x.name)} · ${x.day}日目${x.kind === 'farewell' ? '（お別れ）' : ''}</span></div>`).join('')}</div>` : '<p class="note">手直しする前の絵や、お別れした子がここに残ります。</p>'}`, { wide: true });
}

// ---- カフェ ----
function cafeMenu() {
  const g = S.guest(state), list = S.matches(state);
  modal(`<h2>メニュー（${CATEGORIES[g.wants].name}）</h2>
    ${list.length ? `<div class="pen-grid">${list.map(m => `<button class="pen-item ${m.id === state.cafe.picked ? 'on' : ''}" data-act="pick" data-id="${m.id}" ${state.cafe.step !== 'order' ? 'disabled' : ''}><img src="${m.image}" alt="" draggable="false"><span>${esc(m.name)}${m.self ? ' ✎' : ''}<br><small>${m.price}コイン</small></span></button>`).join('')}</div>` : '<p class="note">この種類の料理がまだありません。</p>'}
    <button class="btn wide" data-act="new" ${state.cafe.step !== 'order' ? 'disabled' : ''}>${icon('pen', 20)} 新しい料理を描く</button>`, {
    wide: true,
    onAct: async (a, el) => {
      if (a === 'pick') { S.pickDish(state, el.dataset.id); closeModal(); say('pet', 'それにするね'); await persist(); renderHUD(); }
      if (a === 'new') { closeModal(); await newDish(); }
    },
  });
}
async function newDish() {
  const g = S.guest(state), have = new Set(state.cafe.menu.map(m => m.name));
  const gallery = PEN_DISHES.filter(d => d.cat === g.wants && !have.has(d.name)).map(d => ({ src: d.src, name: d.name, dish: d }));
  const r = await drawFlow({ title: `新しい${CATEGORIES[g.wants].name}`, gallery });
  if (!r) return;
  const base = { sweet: 220, drink: 160, meal: 280, salty: 190 }[g.wants];
  modal(`<h2>料理の名前</h2><div class="paper small"><img src="${r.image}" alt="" draggable="false"></div>
    <label class="field">名前<input id="dish-name" maxlength="14" value="${esc(r.pen?.dish.name || '')}" placeholder="例：くまのパンケーキ"></label>
    <button class="btn primary wide" data-act="ok">メニューに入れる</button>`, {
    closable: false,
    onAct: async a => {
      if (a !== 'ok') return;
      const name = $('#dish-name').value.trim() || '名前のない料理';
      const m = S.addDish(state, { name, cat: g.wants, image: r.image, self: r.self, price: r.pen?.dish.price || base });
      S.pickDish(state, m.id);
      closeModal();
      if (r.self) toast('自分で描いた料理は、はじめて出すとボーナスがつきます');
      await persist(); renderHUD();
    },
  });
}
function expandMenu() {
  const lv = state.cafe.level, next = CAFE_LEVELS[lv + 1];
  modal(`<h2>お店を広げる</h2><p class="note">いま：${CAFE_LEVELS[lv].name}${next ? `<br>つぎ：${next.name}（${next.price.toLocaleString()}コイン・売上が少し上がる）` : '<br>これ以上は広げられません'}</p>${next ? `<button class="btn primary wide" data-act="ok" ${state.coins < next.price ? 'disabled' : ''}>広げる</button>` : ''}`, {
    onAct: async a => {
      if (a !== 'ok') return;
      S.expandCafe(state); closeModal(); world.showCafe(state.cafe.level); world.setGuest(guestPic()); syncCafe(); syncPet(); toast(`${CAFE_LEVELS[state.cafe.level].name}になりました`); await persist(); renderHUD();
    },
  });
}

// ---- はじめかた ----
function startFlow() {
  let name = '', pers = null;
  const step1 = () => modal(`<h2>相棒をむかえよう</h2><p class="note">名前と性格は、あとから変えられません。</p>
    <label class="field">名前<input id="pet-name" maxlength="10" value="${esc(name)}" placeholder="例：しろ"></label>
    <div class="list" role="radiogroup" aria-label="性格">${PERSONALITIES.map(p => `<button class="btn wide pers" role="radio" data-act="p" data-id="${p.id}" aria-pressed="${p.id === pers}" aria-checked="${p.id === pers}"><b>${p.name}</b><small>${p.note}</small></button>`).join('')}</div>
    <button class="btn primary wide" data-act="next">つぎへ（絵を用意する）</button>
    <button class="btn wide" data-act="import">セーブを読み込んで続きから</button>`, {
    closable: false,
    onAct: async (a, el) => {
      if (a === 'import') return importSave(() => step1());
      if (a === 'p') {
        pers = el.dataset.id;
        document.querySelectorAll('.pers').forEach(b => { const on = b === el; b.setAttribute('aria-pressed', on); b.setAttribute('aria-checked', on); });
        return;
      }
      if (a !== 'next') return;
      name = $('#pet-name').value.trim();
      if (!name) { toast('名前をつけてね'); $('#pet-name').focus(); return; }
      if (!pers) { toast('性格を選んでね'); return; }
      step2();
    },
  });
  let pic = null;
  const step2 = async () => {
    const r = await drawFlow({ title: `${name}の絵`, gallery: PEN_COMPANIONS, note: '描いた絵が、そのままおへやで暮らします。' });
    if (!r) return pic ? step3() : step1();
    pic = r;
    step3();
  };
  // 自分で描いた場合も魔法のペンの場合も、最後にこの確認画面を通る
  const step3 = () => {
    const p = PERSONALITIES.find(x => x.id === pers);
    modal(`<h2>この子でいい？</h2>
      <div class="paper"><img src="${pic.image}" alt="" draggable="false"></div>
      <dl class="confirm"><dt>名前</dt><dd>${esc(name)}</dd><dt>性格</dt><dd>${esc(p.name)}（${esc(p.note)}）</dd><dt>絵</dt><dd>${pic.self ? '自分で描いた' : '魔法のペンが描いた'}</dd></dl>
      <p class="note">名前と性格は、はじめたあとは変えられません。絵は3日目まで描き直せて、それ以降は手直しだけできます。</p>
      <div class="row-end"><button class="btn" data-act="info">名前・性格をなおす</button><button class="btn" data-act="pic">絵を用意しなおす</button></div>
      <button class="btn primary wide" data-act="go">この子とはじめる</button>`, {
      closable: false,
      onAct: async a => {
        if (a === 'info') return step1();
        if (a === 'pic') return step2();
        if (a !== 'go') return;
        closeModal();
        S.createPet(state, { name, personality: pers, image: pic.image, self: pic.self });
        await persist();
        go('room');
        say('pet', 'はじめまして！');
      },
    });
  };
  step1();
}

// ---- セーブを読み込む（貼りつけ式） ----
function importSave(onCancel) {
  modal(`<h2>セーブを読み込む</h2><p class="note">「セーブを書き出す」でコピーした文字を、下に貼りつけてください。いまの暮らしは上書きされます。</p><textarea id="load-text" class="save-text" placeholder="ここに貼りつける"></textarea><button class="btn primary wide" data-act="load">読み込む</button>`, {
    onAct: async b => {
      if (b === 'close') return onCancel?.();
      if (b !== 'load') return;
      try {
        const raw = $('#load-text').value.trim();
        if (!raw) throw Error('セーブの文字が空です');
        let x;
        try { x = JSON.parse(raw); } catch { throw Error('セーブの文字が途中で切れているか、形がちがいます'); }
        if (x.format !== 'oekaki-kurashi' || !S.valid(x.state)) throw Error('このゲームのセーブではありません');
        state = S.upgrade(x.state);
        await persist(); closeModal(); go('room'); toast('読み込みました');
        if (!state.started) startFlow();
      } catch (err) { toast(err.message); }
    },
  });
}

// ---- 設定 ----
function settings() {
  const view = () => modal(`<h2>設定</h2>
    <div class="set-row"><span>音</span><button class="btn" data-act="sound">${state.sound ? 'オン' : 'オフ'}</button></div>
    <div class="set-row"><span>音量</span><input type="range" id="vol" min="0" max="1" step="0.1" value="${state.volume}"></div>
    <div class="set-row"><span>ハラハラモード<small>放っておくと病気やお別れが起きるかわりに、コインと仲よし度が${HARAHARA.multiplier}倍。切り替えは次の日から。</small></span><button class="btn" data-act="mode">${state.modeNext === 'harahara' ? 'オン' : 'オフ'}</button></div>
    <div class="list">
      <button class="btn wide" data-act="export">セーブを書き出す</button>
      <button class="btn wide" data-act="import">セーブを読み込む</button>
      <button class="btn wide danger" data-act="reset">最初からやり直す</button>
    </div>
    ${DEBUG ? `<details class="debug"><summary>開発用</summary><div class="list">
      <button class="btn wide" data-act="dbg-escape">逃げた状態にする</button>
      <button class="btn wide" data-act="dbg-sick">具合が悪い状態にする</button>
      <button class="btn wide" data-act="dbg-dirty">よごれた状態にする（もうすぐ具合が悪くなる）</button>
      <button class="btn wide" data-act="dbg-coins">コイン ＋1000</button>
      <button class="btn wide" data-act="dbg-day">次の日にする</button>
    </div></details>` : ''}`, {
    onAct: async a => {
      if (a === 'sound') { state.sound = !state.sound; setScene(page === 'cafe' ? 'cafe' : 'room'); await persist(); view(); }
      if (a === 'mode') { state.modeNext = state.modeNext === 'harahara' ? 'normal' : 'harahara'; await persist(); toast('次の日から切り替わります'); view(); }
      if (a === 'export') {
        // artifacts ではダウンロードができないので、テキストをコピーして保存してもらう
        const text = JSON.stringify({ format: 'oekaki-kurashi', state });
        modal(`<h2>セーブを書き出す</h2><p class="note">下の文字をすべてコピーして、メモなどに保存してください。読み込むときは「セーブを読み込む」に貼りつけます。</p><textarea id="save-text" class="save-text" readonly>${esc(text)}</textarea><button class="btn primary wide" data-act="copy">コピーする</button>`, {
          onAct: async b => {
            if (b !== 'copy') return;
            try { await navigator.clipboard.writeText(text); toast('コピーしました'); }
            catch { const t = $('#save-text'); t.focus(); t.select(); toast('選択しました。手動でコピーしてください'); }
          },
        });
      }
      if (a === 'import') importSave();
      // 開発用：ハラハラモードの出来事などを、待たずに試す
      if (a.startsWith('dbg-')) {
        if (!state.started || !state.pet) return toast('相棒を迎えてから使えます');
        const c = state.care;
        if (a === 'dbg-escape') { c.status = 'escaped'; toast('逃げた状態にしました'); }
        if (a === 'dbg-sick') { c.status = 'sick'; c.sick = 0; toast('具合が悪い状態にしました'); }
        if (a === 'dbg-dirty') { c.status = 'ok'; c.dirty = HARAHARA.dirtyToSick - 5; toast('5秒ほどで具合が悪くなります（ハラハラモードのとき）'); }
        if (a === 'dbg-coins') { state.coins += 1000; toast('コインを1000ふやしました'); }
        if (a === 'dbg-day') { S.nextDay(state); toast(`${state.day}日目にしました`); }
        closeModal(); syncPet(); await persist(); renderHUD();
      }
      if (a === 'reset') {
        modal(`<h2>最初からやり直す？</h2><p class="note">相棒、コイン、バッグの中身、買ったおうち、作ったメニューや商品、思い出、設定まで、すべて消えて、はじめて開いたときと同じ状態に戻ります。先にセーブを書き出しておくと安心です。</p><div class="row-end"><button class="btn" data-act="close">やめる</button><button class="btn danger" data-act="yes">すべて消してやり直す</button></div>`, {
          onAct: async b => {
            if (b !== 'yes') return;
            await S.wipe();
            state = S.newState();
            page = 'room'; houseView = 0;
            say('pet', ''); say('guest', '');
            closeModal(); go('room'); startFlow();
          },
        });
      }
    },
  });
  view();
}
function settingsInputs() {
  const root = $('#modal-root');
  root.addEventListener('input', e => { if (e.target.id === 'vol') { state.volume = +e.target.value; setScene(page === 'cafe' ? 'cafe' : 'room'); persist(); } });
}

// ---- 遊んでいる間だけ進む時計 ----
let saveTick = 0;
function loop() {
  if (document.hidden || modalOpen() || document.body.classList.contains('editing') || !state?.started) return;
  const ev = S.tick(state, 1);
  if (ev === 'sick') { say('pet', LINES.sick); syncPet(); }
  if (ev === 'escaped') { syncPet(); toast(`${state.pet.name}が外へ出てしまった`); }
  if (ev === 'gone') { syncPet(); }
  if (ev === 'dirty-hint') say('pet', LINES.dirty);
  if (!ev && Math.random() < 0.04 && page === 'room' && state.stats.hunger < 30) say('pet', LINES.hungry);
  if (ev || state.care.status === 'sick') renderHUD();
  else if (page === 'room') document.querySelectorAll('.pet-card .bar b').forEach((b, i) => (b.style.width = [state.stats.hunger, state.stats.mood, state.stats.bond][i] + '%'));
  if (++saveTick % 10 === 0) persist();
}

init();
