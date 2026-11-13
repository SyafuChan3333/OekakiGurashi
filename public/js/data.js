// ゲームのデータ定義。数は 5.1 の目安（1要素につき4つまで）に合わせている。

export const PERSONALITIES = [
  { id: 'playful', name: 'やんちゃ', note: 'よく走って、よく跳ねる', speed: 1.4, wait: [1.5, 3] },
  { id: 'curious', name: '好奇心おう盛', note: 'あちこち見て回る', speed: 1.0, wait: [2, 4] },
  { id: 'sleepy', name: 'ねぼすけ', note: 'ほとんど動かない', speed: 0.5, wait: [7, 12] },
  { id: 'clingy', name: 'あまえんぼ', note: 'きみのそばにいたがる', speed: 0.8, wait: [3, 6] },
];

// 魔法のペンが描ける絵（仮素材。assets/pen/ のファイルを差し替えれば変わる）
export const PEN_COMPANIONS = [
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
