// ゲームのルール（js/store.js）を、ブラウザなしで確かめる
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
const S = await import('../public/js/store.js');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'NG  '} ${name}${detail ? ' — ' + detail : ''}`); };

// ハラハラモード：次の日から反映、倍率、放っておくと出来事が起きる
const s = S.newState(); S.createPet(s, { name: 'a', personality: 'playful', image: 'x', self: true });
s.modeNext = 'harahara';
check('ハラハラは当日には反映しない', s.mode !== 'harahara');
S.nextDay(s);
check('ハラハラは次の日から', s.mode === 'harahara', `倍率 ${S.gainRate(s)}`);
let events = []; for (let i = 0; i < 1200; i++) { const e = S.tick(s, 1); if (e) events.push(e); }
check('放っておくと出来事が起きる', events.length > 0, events.join(' → '));

// 逃げた子を連れ戻す
const t = S.newState(); S.createPet(t, { name: 'b', personality: 'playful', image: 'x', self: false });
t.care.status = 'escaped'; S.bringBack(t);
check('迎えに行くと戻る', t.care.status === 'ok');

// 描き直せる期間
t.day = 2; check('2日目は白紙から描き直せる', S.canRedrawFresh(t));
t.day = 5; check('5日目は描き直せない', !S.canRedrawFresh(t));

// 魔法のペンの絵には手を入れない（設計書 2.7）
const pp = S.newState(); S.createPet(pp, { name: 'p', personality: 'playful', image: 'assets/pen/cat3.png', self: false });
check('魔法のペンの子は手直しできない', !S.canTouchUp(pp));
S.touchUpPet(pp, 'assets/pen/cat5.png', false);
check('ペンで描き直しても、ペンの子のまま', pp.pet.self === false && !S.canTouchUp(pp));
S.touchUpPet(pp, 'data:image/png;base64,xx', true);
check('自分で描き直すと、手直しできるようになる', S.canTouchUp(pp));
check('描き直し前の絵は、ペンの絵かどうかを覚えている', pp.memories.at(-1).self === false && pp.memories.at(-2).self === false);

// スケッチブック：自分で描いた絵だけ保存・共有できる。はじめからある料理・商品は並ばない（設計書 2.6・2.7）
// 描いた時刻がぶつからないように、時計を1秒ずつ進める
const realNow = Date.now; let clock = 1.7e12; Date.now = () => (clock += 1000);
const sb = S.newState(); S.createPet(sb, { name: 'しろ', personality: 'playful', image: 'data:image/png;base64,me', self: true });
sb.day = 2; S.addDish(sb, { name: 'くまパン', cat: 'sweet', image: 'data:image/png;base64,dish', self: true, price: 200 });
sb.day = 3; S.addShopItem(sb, { kind: 'toy', toy: 'ball', name: 'ペンのボール', image: 'assets/pen/toy-ball.svg', self: false });
S.touchUpPet(sb, 'assets/pen/cat3.png', false);
const book = S.sketchbook(sb);
check('スケッチブックに描いた絵が並ぶ（はじめからの料理・商品は並ばない）', book.length === 4, book.map(x => `${x.kind}:${x.day}`).join(' '));
// 描いた時刻の古い順（設計書 2.6）。描き直す前の相棒は、最初に描いた時刻の位置。いまの相棒は描き直した時刻の位置
check('スケッチブックは描いた時刻の古い順（いまの相棒も先頭に固定しない）', book.map(x => x.kind).join(' ') === 'before dish toy pet', book.map(x => x.kind).join(' '));
const legacy = S.sketchbook({ ...sb, memories: [...sb.memories, { kind: 'farewell', name: '昔の子', image: 'data:old', self: true, day: 1 }] });
check('描いた時刻の記録がない絵は、いちばん古い側にまとめる', legacy[0].name === '昔の子');
Date.now = realNow;
check('魔法のペンの絵は保存・共有できない', book.filter(x => !x.self).every(x => x.image.startsWith('assets/pen/')) && book.some(x => x.self));

// ポスター：描いたものはためておき、どれを飾るか選ぶ。カフェのメニューと同じく12枚まで（設計書 3.9）
const ps = S.newState();
const p1 = S.addPoster(ps, { image: 'data:image/png;base64,a', self: true });
const p2 = S.addPoster(ps, { image: 'assets/pen/poster-sun.svg', self: false, pen: 'assets/pen/poster-sun.svg' });
check('描いたポスターはためておかれ、最後に描いたものを飾る', ps.posters.length === 2 && S.currentPoster(ps).id === p2.id);
S.addPoster(ps, { image: 'assets/pen/poster-sun.svg', self: false, pen: 'assets/pen/poster-sun.svg' });
check('魔法のペンの同じ絵は1枚にまとめる', ps.posters.length === 2);
S.hangPoster(ps, p1.id); check('前のポスターに飾り替えられる', S.currentPoster(ps).id === p1.id);
S.hangPoster(ps, null); check('はずせる', S.currentPoster(ps) === null && ps.posters.length === 2);
for (let i = 0; ps.posters.length < S.POSTER_MAX; i++) S.addPoster(ps, { image: 'data:x' + i, self: true });
let threw = false; try { S.addPoster(ps, { image: 'data:over', self: true }); } catch { threw = true; }
check(`ポスターは${S.POSTER_MAX}枚まで`, S.posterFull(ps) && threw);
const old = S.upgrade({ ...S.newState(), posters: undefined, poster: { image: 'data:old', self: true, drawnDay: 2 } });
check('以前のセーブのポスターは、一覧の1枚目に移して飾ったまま', old.posters.length === 1 && S.currentPoster(old)?.image === 'data:old');
check('スケッチブックに、ためたポスターが全部並ぶ', S.sketchbook(ps).filter(x => x.kind === 'poster').length === S.POSTER_MAX);

// カフェ：出来ばえ「よい」でチップ
const c = S.newState(); S.createPet(c, { name: 'c', personality: 'playful', image: 'x', self: false });
c.cafe.guestNo = 1; // 飲みものを頼むお客さま（はじめから持っている料理で出せる）
const dish = S.matches(c)[0];
check('注文に合う料理がある', !!dish);
S.pickDish(c, dish.id); S.applyCook(c, { done: true, quality: 'good' });
const sale = S.serveDish(c);
check('「よい」でチップがつく', sale.tip > 0, `売上 ${sale.total}・チップ ${sale.tip}`);

// 上限：いっぱいのときは描く前に止められるよう、いっぱいかどうかを先に知れる
const mf = S.newState(); S.createPet(mf, { name: 'm', personality: 'playful', image: 'x', self: false });
while (!S.menuFull(mf)) S.addDish(mf, { name: 'd' + mf.cafe.menu.length, cat: 'sweet', image: 'x', self: true, price: 100 });
check(`メニューは${S.MENU_MAX}品でいっぱい`, mf.cafe.menu.length === S.MENU_MAX);
while (!S.shopFull(mf)) S.addShopItem(mf, { kind: 'food', name: 'f', image: 'x', self: true });
check(`商品は${S.SHOP_MAX}個でいっぱい`, mf.shop.length === S.SHOP_MAX);

// 法的表示：コラボの相棒と、credit を持つ魔法のペンの相棒がキャラクターに並ぶ
{
  const D = await import('../public/js/data.js');
  const kinds = D.legalSections().map(x => x.kind);
  check('法的表示は LEGAL_KINDS の順に並ぶ', kinds.join() === Object.keys(D.LEGAL_KINDS).filter(k => kinds.includes(k)).join());
  check('法的表示のキャラクターにコラボの相棒が出る', D.VT_COMPANIONS.every(c => D.legalSections()[0].items.some(x => x.name === c.name)));
  D.PEN_COMPANIONS.push({ src: 'x', name: 'ためし', credit: '© ためしの人' });
  check('credit を持つ相棒は、表記つきで出る', D.legalSections()[0].items.some(x => x.name === 'ためし' && x.by === '© ためしの人'));
  D.PEN_COMPANIONS.pop();
}

// 相棒の気持ち（設計書 3.8）：うれしい ＞ すねる ＞ しょんぼり ＞ ごきげん ＞ ふつう
{
  const D = await import('../public/js/data.js');
  const f = S.newState(); S.createPet(f, { name: 'f', personality: 'playful', image: 'x', self: true }); f.started = true;
  f.stats.mood = 50;
  check('はじめは「ふつう」', S.feeling(f) === 'normal');
  f.stats.mood = D.FEELING.cheerful;
  check('ごきげんが高いと「ごきげん」', S.feeling(f) === 'cheerful');
  f.stats.hunger = D.FEELING.hungry - 1;
  check('おなかがすくと「しょんぼり」で、理由はおなか', S.feeling(f) === 'down' && S.needs(f).join() === 'hunger');
  f.care.dirty = D.FEELING.dirty; f.care.lonely = D.FEELING.lonely;
  check('ふつうモードでは、よごれ・さみしさもしょんぼりの理由', S.needs(f).join() === 'hunger,dirty,lonely');
  f.mode = 'harahara';
  check('ハラハラモードのさみしさは「すねる」', S.feeling(f) === 'sulky' && !S.needs(f).includes('lonely'));
  S.pet(f);
  check('なでると「うれしい」', S.feeling(f) === 'happy');
  check(`「うれしい」は${D.FEELING.happySec}秒で終わる`, S.feeling(f, Date.now() + D.FEELING.happySec * 1000 + 1) === 'down');
  f.care.status = 'escaped';
  check('逃げている間は気持ちを出さない', S.feeling(f) === null);
}

// 表情の差分（設計書 3.8）：ない枠は代わりで埋まる。差分がない子は基本の絵と揺れ
{
  const D = await import('../public/js/data.js');
  const f = S.newState(); S.createPet(f, { name: 'f', personality: 'playful', image: 'base.png', self: false });
  check('差分がない子は、どの気持ちでも基本の絵で、口パクの絵はない', ['normal', 'cheerful', 'down'].every(k => { const r = S.petFaces(f, k); return r.still === 'base.png' && r.talk === null; }));
  D.PEN_COMPANIONS.push({ src: 'base.png', name: 'ためし', faces: { talk: 'talk.png', smile: 'smile.png', sad: 'sad.png' } });
  const fc = k => S.petFaces(f, k);
  check('ふつうは基本の絵、話すときは基本・口あけ', fc('normal').still === 'base.png' && fc('normal').talk === 'talk.png');
  check('ごきげんはにこにこ。にこにこ・口あけがなければ基本・口あけ', fc('cheerful').still === 'smile.png' && fc('cheerful').talk === 'talk.png');
  check('うれしいの絵がなければ、にこにこ', fc('happy').still === 'smile.png');
  check('すねるのおこりの絵がなければ、かなしい', fc('sulky').still === 'sad.png' && fc('sulky').talk === null);
  D.PEN_COMPANIONS.pop();
}

const ng = results.filter(r => !r).length;
console.log(ng ? `\n${ng} 件 NG` : '\nすべて ok');
process.exitCode = ng ? 1 : 0;
