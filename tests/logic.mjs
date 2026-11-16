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

// カフェ：出来ばえ「よい」でチップ
const c = S.newState(); S.createPet(c, { name: 'c', personality: 'playful', image: 'x', self: false });
c.cafe.guestNo = 1; // 飲みものを頼むお客さま（はじめから持っている料理で出せる）
const dish = S.matches(c)[0];
check('注文に合う料理がある', !!dish);
S.pickDish(c, dish.id); S.applyCook(c, { done: true, quality: 'good' });
const sale = S.serveDish(c);
check('「よい」でチップがつく', sale.tip > 0, `売上 ${sale.total}・チップ ${sale.tip}`);

const ng = results.filter(r => !r).length;
console.log(ng ? `\n${ng} 件 NG` : '\nすべて ok');
process.exitCode = ng ? 1 : 0;
