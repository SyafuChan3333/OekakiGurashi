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
let events = []; for (let i = 0; i < 400; i++) { const e = S.tick(s, 1); if (e) events.push(e); }
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
const sb = S.newState(); S.createPet(sb, { name: 'しろ', personality: 'playful', image: 'data:image/png;base64,me', self: true });
sb.day = 2; S.addDish(sb, { name: 'くまパン', cat: 'sweet', image: 'data:image/png;base64,dish', self: true, price: 200 });
sb.day = 3; S.addShopItem(sb, { kind: 'toy', toy: 'ball', name: 'ペンのボール', image: 'assets/pen/toy-ball.svg', self: false });
S.touchUpPet(sb, 'assets/pen/cat3.png', false);
const book = S.sketchbook(sb);
check('スケッチブックに描いた絵が並ぶ（はじめからの料理・商品は並ばない）', book.length === 4, book.map(x => `${x.kind}:${x.day}`).join(' '));
check('スケッチブックは、いまの相棒が先頭で、ほかは新しい順', book[0].kind === 'pet' && book.at(-1).kind === 'dish', book.map(x => x.kind).join(' '));
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

const ng = results.filter(r => !r).length;
console.log(ng ? `\n${ng} 件 NG` : '\nすべて ok');
process.exitCode = ng ? 1 : 0;
