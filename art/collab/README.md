# コラボの相棒の元の絵（公開しない）

VTuber コラボでいただいた相棒の絵の、元の大きいファイルを置く場所です。

- **`public/` の外なので、GitHub Pages では公開されません**。ゲームが読むのは `public/assets/pen/` に置いた縮小版だけです
- 使っていない絵（表情の差分など）は、権利の確認が済むまでここだけに置き、`public/` には入れません（`public/` のファイルは URL を知っていれば誰でも開けるため）
- 魔法のペンの絵なので、ゲームの中でも手直し・保存・共有はできません（設計書 2.7）

| ファイル | 中身 | 公開版 |
|---|---|---|
| `vt-rotan-happy.png` | 龍惺ろたん・笑顔（1536×1536） | `public/assets/pen/vt-rotan-happy.png`（512×512） |
| `vt-rotan-normal.png` | 龍惺ろたん・普通目 | まだ使っていない |
| `vt-fuwamu-happy.png` | 宵夢ふわむ・笑顔 | `public/assets/pen/vt-fuwamu-happy.png`（512×512） |
| `vt-fuwamu-normal.png` | 宵夢ふわむ・普通目 | まだ使っていない |
| `vt-miina-happy.png` | 春霞みぃな・笑顔 | `public/assets/pen/vt-miina-happy.png`（512×512） |
| `vt-miina-normal.png` | 春霞みぃな・普通目 | まだ使っていない |

## 公開版の作り方

512×512 に縮めて、`public/assets/pen/` に**同じ名前で**置きます（セーブには絵の場所が入っているので、名前を変えると今いる子の絵が出なくなります）。

```
python3 -c "from PIL import Image; Image.open('art/collab/vt-rotan-happy.png').resize((512, 512), Image.LANCZOS).save('public/assets/pen/vt-rotan-happy.png', optimize=True)"
```
