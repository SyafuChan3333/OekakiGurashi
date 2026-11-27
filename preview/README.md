# artifacts プレビュー用の差し替え

artifacts でプレビューするときだけ、ここにあるファイルを `public/` の同じ場所のファイルの代わりに載せる。artifacts 上のパスは `public/` を外したもの（`public/js/main.js` → `js/main.js`）。

| ファイル | 公開版 | プレビュー |
|---|---|---|
| `js/three.js` | 同梱の `public/vendor/` から読む | jsDelivr から読む（artifacts は外部スクリプトを CDN からしか読めない） |
| `js/config.js` | `?debug` のときだけ開発用ボタン | 開発用ボタンを常に出す |

`vendor/` はプレビューに載せない（three.js は CDN から読む）。`assets/audio/` は載せる（BGM を確かめられるように。2026-11-27 に制作者が判断）。
