// ミニゲーム枠（3.4）
// 本体はお題を渡し、結果 { done, quality } だけを受け取る。中身は知らない。
// 料理・お風呂・遊び（ボール／猫じゃらし／ぬいぐるみ）・迎えに行く。
import { bathGame } from './mg-bath.js';
import { cookGame } from './mg-cook.js';
import { playGame } from './mg-play.js';
import { chaseGame } from './mg-chase.js';

export const MINIGAMES = {
  cook: task => cookGame(task), // 本実装（種類ごとに 注ぐ／焼く／切る／飾る）
  bath: task => bathGame(task), // 本実装（ぬらす→泡→流す→ブロー）
  // おもちゃの種類ごとに別のミニゲーム（本実装）
  ball: task => playGame('ball', task), // 投げる
  wand: task => playGame('wand', task), // 振る
  plush: task => playGame('plush', task), // ぎゅっとする
  chase: task => chaseGame(task), // 迎えに行く（ハラハラモードで逃げたとき。かくれんぼ）
};

export const runMinigame = (id, task) => MINIGAMES[id](task);
