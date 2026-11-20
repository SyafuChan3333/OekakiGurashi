// ゲームのデータ定義。数は 5.1 の目安（1要素につき4つまで）に合わせている。

export const PERSONALITIES = [
  { id: 'playful', name: 'やんちゃ', note: 'よく走って、よく跳ねる', speed: 1.4, wait: [1.5, 3] },
  { id: 'curious', name: '好奇心おう盛', note: 'あちこち見て回る', speed: 1.0, wait: [2, 4] },
  { id: 'sleepy', name: 'ねぼすけ', note: 'ほとんど動かない', speed: 0.5, wait: [7, 12] },
  { id: 'clingy', name: 'あまえんぼ', note: 'きみのそばにいたがる', speed: 0.8, wait: [3, 6] },
];

// コラボの相棒（1枚絵。魔法のペンの相棒の先頭に並ぶ）。
// 公開版は 512×512 の縮小版。元の大きい絵と表情の差分は art/collab/ にある（公開しない）
export const VT_COMPANIONS = [
  { src: 'assets/pen/vt-rotan-happy.png', name: '龍惺ろたん' },
  { src: 'assets/pen/vt-fuwamu-happy.png', name: '宵夢ふわむ' },
  { src: 'assets/pen/vt-miina-happy.png', name: '春霞みぃな' },
];

// 魔法のペンが描ける絵（コラボ以外は仮素材。assets/pen/ のファイルを差し替えれば変わる）
export const PEN_COMPANIONS = [
  ...VT_COMPANIONS,
  { src: 'assets/pen/human1.svg', name: 'しろ' },
  { src: 'assets/pen/human2.svg', name: 'あんず' },
  { src: 'assets/pen/human3.svg', name: 'くるみ' },
  ...Array.from({ length: 10 }, (_, i) => ({ src: `assets/pen/cat${i}.png`, name: ['みるく', 'ミント', 'ちゃちゃ', 'こむぎ', 'もも', 'むぎ', 'すみ', 'ぎん', 'もこ', 'ましろ'][i] })),
];

export const CATEGORIES = {
  sweet: { name: '甘いもの' },
  drink: { name: '飲みもの' },
  meal: { name: 'ごはんもの' },
  salty: { name: 'しょっぱいもの' },
};

// 料理の候補（魔法のペン用）。最初の3品はメニューに入っている
export const PEN_DISHES = [
  { id: 'hamburger', name: 'ハンバーガー', cat: 'meal', price: 240 },
  { id: 'coffee', name: 'ドリップコーヒー', cat: 'drink', price: 140 },
  { id: 'sandwich', name: 'サンドイッチ', cat: 'salty', price: 180 },
  { id: 'cookie', name: 'チョコチップクッキー', cat: 'sweet', price: 180 },
  { id: 'lemonade', name: 'レモネード', cat: 'drink', price: 190 },
  { id: 'toast', name: 'バタートースト', cat: 'salty', price: 210 },
  { id: 'pancake', name: 'いちごのパンケーキ', cat: 'sweet', price: 300 },
  { id: 'soup', name: 'かぼちゃのスープ', cat: 'meal', price: 300 },
  { id: 'omelette', name: 'オムライス', cat: 'meal', price: 420 },
  { id: 'parfait', name: 'パフェ', cat: 'sweet', price: 360 },
  { id: 'latte', name: 'カフェラテ', cat: 'drink', price: 260 },
  { id: 'salad', name: 'サラダ', cat: 'salty', price: 280 },
].map(d => ({ ...d, src: `assets/pen/food-${d.id}.svg` }));
export const STARTER_DISHES = ['hamburger', 'coffee', 'sandwich'];

// お客さま。セリフは話し手ごとに口調を変える（5.2）
export const GUESTS = [
  { id: 'hana', poor: 'ちょっと焦げてる？ でも、いい匂い。', name: 'はな', pic: 2, wants: 'sweet', ask: '甘いの、ある？ おまかせで！', thanks: 'ん、おいしい。', special: 'これ、きみが描いたの？ 食べるのもったいないな。' },
  { id: 'sora', poor: 'あれ、ちょっとこぼれてる？ ま、いっか！', name: 'そら', pic: 1, wants: 'drink', ask: 'のど、からから〜。なんか飲みたい！', thanks: 'ぷはー、生き返った！', special: 'すごい、絵のまんまの味がする！' },
  { id: 'kohaku', poor: '……形はともかく、腹はふくれた。', name: 'こはく', pic: 0, wants: 'meal', ask: 'はらぺこ。急ぎでがっつりのを頼む。', thanks: 'うまい。また来る。', special: '……この絵、いいな。気に入った。' },
  { id: 'tora', poor: 'ふふ、ちょっと不ぞろいだね。', name: 'とら', pic: 4, wants: 'salty', ask: 'しょっぱいもの、つまみたい気分なんだ。', thanks: 'これこれ、こういうの。', special: '手描きのメニューって、なんか落ち着くね。' },
  { id: 'mugi', poor: 'あ、えっと……おいしかった、です。', name: 'むぎ', pic: 5, wants: 'sweet', ask: 'あの、甘いもの……ありますか。', thanks: 'おいしかったです。', special: 'わ……かわいい。写真、撮っていいですか。' },
];

// おうち（4軒）
export const HOUSES = [
  { id: 'washitsu', name: '和室', price: 0, size: 6, wall: '#e8dcc4', floor: '#c9c08f', accent: '#b9a77c' },
  { id: 'atelier', name: 'アトリエ', price: 1200, size: 7.5, wall: '#e9eee6', floor: '#d8c4a2', accent: '#9fb6a5' },
  { id: 'loft', name: '屋根裏のロフト', price: 2400, size: 8.5, wall: '#d9d5e6', floor: '#c8a882', accent: '#8f8fb5' },
  { id: 'garden', name: 'ひろい家', price: 3600, size: 9.5, wall: '#eef0e2', floor: '#d6c09b', accent: '#9dbb93' },
];

// カフェの増築（3段階）
export const CAFE_LEVELS = [
  { name: '小さな店', price: 0, bonus: 1 },
  { name: '二間の店', price: 800, bonus: 1.2 },
  { name: 'テラスのある店', price: 2500, bonus: 1.5 },
];

// コンビニ（3章）。最初に並んでいる商品。描くと増やせて、自分で描いたものは割引になる
export const TOY_TYPES = {
  ball: { name: 'ボール', note: '投げて追いかける', verb: '投げる' },
  wand: { name: '猫じゃらし', note: '振ってじゃれさせる', verb: '振る' },
  plush: { name: 'ぬいぐるみ', note: 'ぎゅっと抱きしめる', verb: 'ぎゅっとする' },
};
export const SHOP_START = [
  { id: 's-cookie', kind: 'food', name: 'クッキー', image: 'assets/pen/food-cookie.svg', price: 20 },
  { id: 's-omelette', kind: 'food', name: 'オムライス', image: 'assets/pen/food-omelette.svg', price: 40 },
  { id: 's-pancake', kind: 'food', name: 'パンケーキ', image: 'assets/pen/food-pancake.svg', price: 60 },
  { id: 's-ball', kind: 'toy', toy: 'ball', name: 'ボール', image: 'assets/pen/toy-ball.svg', price: 60 },
  { id: 's-wand', kind: 'toy', toy: 'wand', name: '猫じゃらし', image: 'assets/pen/toy-wand.svg', price: 80 },
  { id: 's-plush', kind: 'toy', toy: 'plush', name: 'おさかなのぬいぐるみ', image: 'assets/pen/toy-plush.svg', price: 120 },
];
export const NEW_ITEM_PRICE = { food: 40, toy: 90 };
export const SELF_DISCOUNT = 0.7; // 自分で描いた商品は3割引き
export const PEN_FOODS = SHOP_START.filter(x => x.kind === 'food').map(x => ({ src: x.image, name: x.name }));
export const PEN_TOYS = { ball: [{ src: 'assets/pen/toy-ball.svg', name: 'ボール' }], wand: [{ src: 'assets/pen/toy-wand.svg', name: '猫じゃらし' }], plush: [{ src: 'assets/pen/toy-plush.svg', name: 'ぬいぐるみ' }] };

export const PEN_POSTERS = [
  { src: 'assets/pen/poster-sun.svg', name: 'おひさま' },
  { src: 'assets/pen/poster-star.svg', name: 'ほし' },
];

// ハラハラモード（3.5）。時間は試作用に短め
export const HARAHARA = {
  multiplier: 1.5,
  dirtyToSick: 120, // 秒
  sickToGone: 90,
  lonelyToEscape: 150,
};

// ---- 相棒の気持ち（設計書 3.8）----
// 気持ちは「ふつう」＋4つ。いくつも当てはまるときは order の順で1つだけ出す
export const FEELINGS = {
  happy: { name: 'うれしい' },
  sulky: { name: 'すねている' },
  down: { name: 'しょんぼり' },
  cheerful: { name: 'ごきげん' },
  normal: { name: 'ふつう' },
};
// しょんぼりの理由。ステータス欄にアイコンで出して、何をすればいいかわかるようにする
export const NEEDS = {
  hunger: { name: 'おなかがすいた', icon: 'bowl' },
  dirty: { name: 'よごれている', icon: 'bath' },
  lonely: { name: 'さみしい', icon: 'heart' },
  sick: { name: '具合が悪い', icon: 'sick' },
};
// 切り替わる目安（あとで調整する。8章）
export const FEELING = {
  cheerful: 70, // ごきげんがこれ以上で「ごきげん」
  hungry: 30, // おなかがこれ未満で「おなかがすいた」
  dirty: HARAHARA.dirtyToSick / 2, // よごれ（秒）が、病気になるまでの半分を過ぎたら
  lonely: HARAHARA.lonelyToEscape / 2, // さみしさ（秒）が、逃げ出すまでの半分を過ぎたら。ハラハラモードでは「すねる」
  happySec: 5, // なでた・遊んだ・ごはん・お風呂のあと、「うれしい」が続く秒数
};

// ---- 法的表示（設定 → 法的表示）----
// 外から持ってきたもの（ライブラリ・フォント・音など）を足したら、LEGAL_CREDITS に1行足す。
//   { kind, name, by, license?, url?, licenseUrl? }  kind は LEGAL_KINDS のどれか。並びは LEGAL_KINDS の順
// コラボの相棒は、ここには書かない。魔法のペンの相棒の一覧（VT_COMPANIONS など）の credit から自動で並ぶ（設計書 3.8）
export const LEGAL = {
  title: 'おえかき暮らし',
  copyright: '© 2026 SyafuChan3333',
};

export const LEGAL_KINDS = {
  chara: 'キャラクター',
  lib: 'ライブラリ',
  font: 'フォント',
  music: '音楽',
  sound: '効果音',
};

export const LEGAL_CREDITS = [
  { kind: 'lib', name: 'three.js', by: 'three.js authors', license: 'MIT License', url: 'https://threejs.org/', licenseUrl: 'vendor/THREE-LICENSE.txt' },
  { kind: 'font', name: 'Yusei Magic', by: 'Tanukizamurai', license: 'SIL Open Font License 1.1', url: 'https://github.com/tanukifont/YuseiMagic' },
  { kind: 'font', name: 'Yomogi', by: 'Satsuyako', license: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/specimen/Yomogi' },
  { kind: 'music', name: '日向ぼっこ・のほほん喫茶', by: '甘茶（甘茶の音楽工房）', url: 'https://amachamusic.chagasi.com/' },
  { kind: 'sound', name: 'Interface Sounds', by: 'Kenney', license: 'CC0', url: 'https://kenney.nl/assets/interface-sounds' },
  { kind: 'sound', name: 'Meow of a Siamese cat', by: 'freemaster2', license: 'CC0', url: 'https://commons.wikimedia.org/wiki/File:Meow_of_a_Siamese_cat_-_freemaster2.wav' },
];

// 法的表示に並べる中身を、種類ごとにまとめて返す。
// キャラクター：コラボの相棒（いまは名前だけ）と、credit を持つ魔法のペンの相棒
export function legalSections() {
  const chara = PEN_COMPANIONS
    .filter(c => c.credit || VT_COMPANIONS.includes(c))
    .map(c => ({ kind: 'chara', name: c.name, by: c.credit || '' }));
  const all = [...chara, ...LEGAL_CREDITS];
  return Object.entries(LEGAL_KINDS)
    .map(([kind, title]) => ({ kind, title, items: all.filter(x => x.kind === kind) }))
    .filter(s => s.items.length);
}
