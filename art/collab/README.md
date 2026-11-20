# コラボの相棒の元の絵（公開しない）

VTuber コラボでいただいた相棒の絵の、元の大きいファイルを置く場所です。

- **`public/` の外なので、GitHub Pages では公開されません**。ゲームが読むのは `public/assets/pen/` に置いた縮小版だけです
- 使っていない絵は、権利の確認が済むまでここだけに置き、`public/` には入れません（`public/` のファイルは URL を知っていれば誰でも開けるため）
- 魔法のペンの絵なので、ゲームの中でも手直し・保存・共有はできません（設計書 2.7）

いまは3人とも、7枚の表情をすべて使っています（#24）。ファイル名は `vt-<名前>-<表情>.png` で、元の絵は 1536×1536、公開版は 512×512 です。

| 表情 | ファイル名の末尾 | ゲームでの枠（設計書 3.8） |
|---|---|---|
| 普通目（基本の絵） | `-normal` | 基本（`src`） |
| 普通目・口開け | `-normalTalk` | `talk` |
| 笑顔 | `-smile` | `smile` |
| 笑顔・口開け | `-smileTalk` | `smileTalk` |
| うれしい | `-happy` | `happy` |
| 悲しみ | `-sad` | `sad` |
| 怒り | `-angry` | `angry` |

| 名前 | ファイルの頭 |
|---|---|
| 龍惺ろたん | `vt-rotan` |
| 宵夢ふわむ | `vt-fuwamu` |
| 春霞みぃな | `vt-miina` |

一覧（`public/js/data.js` の `VT_COMPANIONS`）は、`vtCompanion('vt-rotan', '龍惺ろたん')` の1行で7枚すべてを使います。7枚とも、大きさと位置合わせがそろっている必要があります（差し替えたときに体がずれないように）。

## 公開版の作り方

512×512 に縮めて、`public/assets/pen/` に**同じ名前で**置きます（セーブには絵の場所が入っているので、名前を変えると今いる子の絵が出なくなります）。

```
python3 -c "from PIL import Image; Image.open('art/collab/vt-rotan-smile.png').resize((512, 512), Image.LANCZOS).save('public/assets/pen/vt-rotan-smile.png', optimize=True)"
```
