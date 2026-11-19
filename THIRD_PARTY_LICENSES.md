# Third-party notices

このサイトで配信(GitHub Pages に配置)されるファイルに含まれる第三者のソフトウェア・データです。
いずれも商用利用・再配布が可能な許諾型ライセンスで、著作権表示とライセンス文を同梱することが条件です。

| コンポーネント | バージョン | ライセンス | 著作権者 | 同梱場所 / ライセンス文 |
|---|---|---|---|---|
| Bootstrap(Popper を含む) | 5.3.9 | MIT | The Bootstrap Authors / Popper: Federico Zivolo | `vendor/bootstrap/`(`LICENSE`) |
| Bootstrap Icons | 1.13.2 | MIT | The Bootstrap Authors | `vendor/bootstrap-icons/`(`LICENSE`) |
| node-qrcode | 1.5.4 | MIT | Ryan Day | `vendor/qrcode/qrcode.bundle.js`(`LICENSE`) |
| dijkstrajs(node-qrcode の依存、上記バンドルに含む) | 1.0.3 | MIT | Wyatt Baldwin ほか | `vendor/qrcode/LICENSE-dijkstrajs.md` |
| zxing-wasm | 3.1.7 | MIT | Ze-Zheng Wu | `vendor/zxing-wasm/`(`LICENSE`) |
| zxing-cpp(zxing-wasm の WASM に含む) | — | Apache-2.0 | ZXing authors / zxing-cpp authors | `vendor/zxing-wasm/LICENSE-zxing-cpp.txt` |
| OpenCV ArUco 辞書データ | 4.10.0 | Apache-2.0 | OpenCV team | `js/aruco-dicts.js`(`vendor/OPENCV-LICENSE.txt`) |
| AprilTag 3 ファミリーデータ | 3.x | BSD-2-Clause | The Regents of The University of Michigan | `js/dicts/tag*.js`(`vendor/APRILTAG-LICENSE.md`) |

- Apache-2.0 のコンポーネントは改変していません(辞書データは数値表を JavaScript の配列に変換したもので、変換元を各ファイル冒頭に記載しています)。NOTICE ファイルは配布元に存在しません。
- 次のものは開発・検証時のみ Docker 内で使い、サイトには含まれません: esbuild(MIT、node-qrcode のバンドル作成)、pngjs(MIT)、opencv-python-headless(Apache-2.0)、NumPy(BSD-3-Clause)、poppler-utils(GPL-2.0、PDF→PNG 変換のコマンドとして実行するだけ)、nginx(BSD-2-Clause、ローカル確認用)。
- `tests/out/` の AprilTag 公式画像(apriltag-imgs)は `.gitignore` 済みで、リポジトリにも含めません。
