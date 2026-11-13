# おえかき暮らし：作業メモ（Claude 向け）

自分で描いた相棒と暮らす、お絵かき＋お世話のブラウザゲーム。ビルドなしの静的サイト（ES Modules）。
制作者とのやり取りは日本語。コメント・コミットメッセージ・ゲーム内の文言も日本語で書く。

## 参照先

- 設計書（正本・話し合いの場）：Claude Docs「おえかき暮らし 新規書き下ろし 設計指示書」 https://claude.ai/artifact/CrZ9hh7JDV9dQkWmCRP7zi
  - 7章が「いまの状況とマイルストーン」。次に何をやるかはここで決まる
  - 5章「開発時の注意事項」（複雑さの上限・避けるべき表現）を守る
- プレビュー（artifacts）：https://claude.ai/artifact/FgZ6WiqbZtyTt4Km9BwuHk
- 公開：GitHub Pages（`main` ブランチのルートをそのまま配信）

## 作業の流れ

1. 依頼ごとに `main` からブランチを切る（例：`feat/garden`、`fix/bath-drag`）
2. 変更 → `npm test` → 見た目に関わる変更はスクリーンショットで自分の目でも確かめる
3. artifacts のプレビューに反映して、制作者に触ってもらう（下の「プレビュー」）
4. プルリクエストを出す。`main` へのマージは制作者がする
- 強制プッシュ・履歴の書き換え・リポジトリの設定変更はしない
- 節目にはタグを付ける（`v0.1.0` ＝ マイルストーン1）

## プレビュー（artifacts）

artifacts は外部スクリプトを CDN からしか読めない・ダウンロードできない・IndexedDB が使えないことがある。
そのため公開版と2ファイルだけ違う。差し替えは `preview/` に置いてある（詳しくは `preview/README.md`）。

- 公開するのは `index.html`・`style.css`・`js/`・`assets/pen/`・`assets/favicon.svg`。`vendor/` と `assets/audio/` は載せない
- `js/three.js` と `js/config.js` は、`preview/js/` の同名ファイルを載せる
- 変えたファイルだけを載せ直せばよい（publish_files は載せなかったファイルを残す）

## 決まりごと（設計書から、コードを書くときに効くもの）

- **ゲーム本体は依存なし**。three.js は `vendor/` に同梱。`package.json` はテスト用だけ
- **CSS は `style.css` 1ファイル**。後から上書きする CSS を積み重ねない
- **画面**：全画面の3D＋HUD。詳しい内容はポップアップ。スマホ縦向きが基準（幅 390px で必ず確認）
- **操作**：スマホのブラウザ前提。長押し・ダブルタップ・画面端のスワイプは使わない。共通の入力は `js/input.js`（`onDrag` は `pointercancel` も終わりとして扱う）
- **ミニゲーム**：`js/minigames.js` の共通の枠。結果は `{ done, quality }`。本体はミニゲームの中身を知らない
  - 報酬は3段：完成で基本 → 出来ばえ「よい」で上乗せ → 自分で描いたもので上乗せ
  - 遊び・お風呂・迎えに行くには「失敗」がない
  - 工程が変わったら、指を一度離すまで判定しない
- **描く**：世界は全部プレイヤーが描いたもの、という扱い。用意した絵は「魔法のペンが描いた」もの（`assets/pen/`）
- **状態とルール**は `js/store.js`、画面は `js/main.js`。ルールを画面側に書かない
- **文言**：短い話し言葉。英語のキャッチコピー、大げさな形容、絵文字は使わない（設計書 5.2）
- **開発用ボタン**：URL に `?debug` を付けたときだけ設定に出る（`js/config.js`）。プレビューでは常に出る

## ファイル

| 場所 | 役割 |
|---|---|
| `index.html` / `style.css` | 画面の骨組みと見た目。起動画面（`#splash`）もここ |
| `js/main.js` | 画面の切り替え、HUD、操作のつなぎこみ、設定 |
| `js/store.js` | 状態とルール、セーブ（IndexedDB → localStorage） |
| `js/data.js` | 性格・料理・お客さま・おうち・商品などのデータ |
| `js/scene.js` | three.js の3D（おへや・カフェ・コンビニ・相棒） |
| `js/draw.js` | 自分で描く／魔法のペン、お絵かきエディタ |
| `js/minigames.js` + `js/mg-*.js` | ミニゲームの枠と、各ミニゲーム |
| `js/splash.js` | 起動画面の後半（タップしてはじめる。最初のタップで音を使えるようにする） |
| `js/input.js` / `js/audio.js` / `js/ui.js` | 入力の共通処理 / 効果音（合成）/ アイコン・ポップアップ・吹き出し |
| `js/config.js` / `js/three.js` | 動作の切り替え / three.js の読み込み口（プレビューでは差し替え） |
| `tests/` | 自動の確認（下） |

## テスト

```
npm install            # 初回だけ（playwright）
npx playwright install chromium   # 初回だけ。手元の Chrome を使うなら CHROME_PATH=/path/to/chrome
npm test               # ルール → 通しプレイ → ミニゲーム
npm run serve          # http://localhost:8765/ で手で確かめる（?debug で開発用ボタン）
```

- `tests/logic.mjs`：`js/store.js` のルールをブラウザなしで
- `tests/smoke.mjs`：起動 → 相棒を迎える → おへや → カフェで1人に出す → コンビニ → セーブ → 迎えに行く
- `tests/minigames.mjs`：各ミニゲームが描画され、結果を返すか
- スクリーンショットは `tests/out/`（git には入れない）
- 機能を足したら、通しプレイかミニゲームのテストに1行でも足す
