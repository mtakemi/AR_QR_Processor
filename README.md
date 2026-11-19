# AR / QR Processor

ARマーカー(ArUco / AprilTag)と QR コードの生成・画像解析を、ブラウザだけで行う静的 Web アプリです。
ビルドもサーバー側の処理も必要ありません。画像やカメラ映像は外部に送信されず、すべてブラウザ内で処理します。

[GitHub Pages のページ](https://mtakemi.github.io/AR_QR_Processor/) 

## 機能

### 画像解析

- 画像はファイル選択、ドラッグ&ドロップ、Ctrl+V の貼り付け、「クリップボードから」ボタンで読み込めます。
- 1枚の画像に含まれる複数の QR コード(QR・Micro QR・rMQR)と ArUco / AprilTag マーカーを検出し、結果を画像に重ねて表示します。
- 色を反転したマーカーや、白い余白がない(画像の端に接している)マーカーも検出できます。

### カメラ読み取り

- 「カメラで読み取り」ボタンを押したときだけカメラを起動し、リアルタイムに検出します。
- 「静止画にして詳しく解析」で、その時点の映像を詳しく解析できます。
- タブを離れると自動で停止します。

### QR コード生成

- エンコードモード(自動 / 数字 / 英数字 / バイト / 漢字)
- 誤り訂正レベル L / M / Q / H、バージョン 1〜40、マスク 0〜7
- 余白、セルサイズ、前景色・背景色
- PNG / SVG で出力

### ARマーカー生成

- 辞書と ID を選び、黒枠のビット数(OpenCV 辞書のみ)、白余白、セルサイズ、印刷サイズ(mm)、ラベルを指定できます。
- PNG / SVG で出力します。SVG は指定した mm の実寸になります。

### ARマーカー一括生成(PDF)

- `1-5` や `1,2-4,7` のように ID を指定し、A4 / A3(縦・横)の用紙に並べた印刷用 PDF を出力します。
- サイズの基準(検出枠 / 外寸)、mm 単位のサイズ、用紙の余白、枠の間隔、ラベルを指定できます。
- 各マーカーは必須の白余白を個別に持ち、点線の切り取り枠(白余白とラベルを含む)で囲まれます。切り取っても余白が残ります。
- 1枚に入りきらない場合は警告を出します。そのまま出力すると複数ページになります。
- 100% で印刷すると実寸になります。

### 表示言語

- 日本語(既定)と英語に対応しています。画面右上のメニューで切り替えられ、選んだ言語は次回も使われます。
- URL に `?lang=en` を付けると、英語で開きます(`?lang=ja` で日本語)。
- 文言は `js/i18n.js` にまとめています。言語を追加するときは、そこに辞書を足します。

## 対応する辞書

| 種類 | 辞書 |
|---|---|
| ArUco(OpenCV) | 4X4 / 5X5 / 6X6 / 7X7 の 50・100・250・1000、ARUCO_ORIGINAL、ARUCO_MIP_36h12 |
| AprilTag(OpenCV の classic) | 16h5、25h9、36h10、36h11 |
| AprilTag 3 | tagStandard41h12、tagStandard52h13、tagCircle21h7、tagCircle49h12、tagCustom48h12 |

解析では、辞書を「自動」にするとすべての辞書から探します。

### AprilTag 3 について

- 公式ライブラリ(AprilRobotics/apriltag)のレイアウトとコードをそのまま使っています。生成画像は公式画像(apriltag-imgs)とピクセル単位で一致します。
- 検出では、黒枠の内側の白い枠(reversed border)を四角形として見つけ、その枠を基準にデータビットを読みます。誤り訂正は、AprilTag の既定と同じく最大 2 ビットです。
- 円形タグの四隅や tagCustom48h12 の中央 2×2 など、使われないセル(公式画像では透明)は白で出力します。
- tagCircle49h12 など大きなファミリーのデータ(最大約 600KB)は、そのファミリーを使うときだけ読み込みます。

## 動作環境

- 最近の Chrome / Edge / Firefox / Safari で動きます(ES Modules、Web Worker、WebAssembly を使います)。
- `index.html` を直接(`file://`)開くと WASM やワーカーを読み込めないため、HTTP サーバー経由で開いてください。ローカルでは、たとえば次のコマンドで起動できます。

  ```bash
  docker run --rm -p 8080:80 -v "$(pwd -W):/usr/share/nginx/html:ro" nginx:alpine
  ```

- カメラは HTTPS か localhost でだけ使えます。

## 構成

```
index.html            画面(Bootstrap 5)
css/app.css
js/theme.js           テーマ(ライト / ダーク)と表示言語を、描画前に適用
js/i18n.js            多言語対応(日本語 / 英語の文言)
js/app.js             UI・カメラ
js/qr.js              QR 生成(node-qrcode)/ 解析(zxing-wasm)
js/aruco.js           ArUco / AprilTag の生成と検出(自前実装)
js/aruco-worker.js    検出を Web Worker で実行
js/aruco-dicts.js     辞書データ(OpenCV 4.10.0 から自動生成)
js/dicts/tag*.js      AprilTag 3 ファミリーのデータ(apriltag の C ソースから自動生成、遅延読み込み)
js/render.js          描画・ダウンロード
js/batch.js           一括生成(ID 指定の解析・用紙への配置・PDF 出力。ライブラリ不使用)
vendor/               同梱ライブラリ(Bootstrap, Bootstrap Icons, node-qrcode, zxing-wasm)
tools/                vendor / 辞書データの再生成スクリプト
tests/                OpenCV と突き合わせる検証スクリプト
```

## 制限事項

- ARToolKit のパターン / バーコードマーカーには対応していません。
- マーカー検出は自前の実装で、OpenCV 相当の誤り訂正つきです。処理は、輪郭の抽出 → 四角形の近似 → グリッドのサンプリング → 辞書との照合の順に行います。強い斜め、ブレ、ごく小さいマーカーは取りこぼすことがあります。
- 画像の端に接しているマーカーや、画像全体がマーカーの場合は、仮想的な白い余白を足して検出します。マーカーが黒っぽい背景や別のマーカーに直接接している場合は、外枠の境目がないため検出できません(OpenCV でも同じです)。
- classic AprilTag(DICT_APRILTAG_*)の四隅の順序は OpenCV の定義に従います。AprilTag 公式画像とは 180° 回転した関係なので、ID は同じですが、「左上」の角が対角になります。
- 3D の姿勢推定は行いません(出力するのは四隅の座標だけです)。
- Micro QR の生成には対応していません(読み取りはできます)。
- 「クリップボードから」ボタンは、ブラウザによって使えないか、許可が必要です。Ctrl+V はどのブラウザでも使えます。

## 開発 / 検証(Docker)

AprilTag 3 の公式画像を `tests/out/at3/` に置くと(例: `tag41_12_00017.png`、AprilRobotics/apriltag-imgs から取得)、生成画像との照合と、変形させたシーンでの検出テストも行います。

```bash
# OpenCV で正解データを作成
docker run --rm -v "$(pwd -W):/workspace" -w /workspace python:3.12-slim sh -c "pip install -q opencv-python-headless numpy && python tests/make_cv_fixtures.py"
# 自前実装と照合(pngjs が必要)
docker run --rm -v "$(pwd -W):/workspace" -w /workspace node:22-bookworm sh -c "npm i -g pngjs >/dev/null && NODE_PATH=\$(npm root -g) node tests/check.mjs"
# 一括生成: 単体テストと PDF 出力 → poppler で 300dpi に変換し、ID と実寸(mm)を確認
docker run --rm -v "$(pwd -W):/workspace" -w /workspace node:22-bookworm node tests/batch.mjs
docker run --rm -v "$(pwd -W):/workspace" -w /workspace/tests/out python:3.12-slim sh -c "apt-get update -qq && apt-get install -y -qq poppler-utils && for f in batch_*.pdf; do pdftoppm -r 300 -gray -png \$f \${f%.pdf}_p; done"
docker run --rm -v "$(pwd -W):/workspace" -w /workspace node:22-bookworm sh -c "npm i -g pngjs >/dev/null && NODE_PATH=\$(npm root -g) node tests/check_pdf.mjs"
# (任意)OpenCV でも確認: pip install opencv-python-headless numpy && python tests/check_pdf.py
```

## プライバシーとセキュリティ

- 外部へのリクエストはありません(CDN、解析タグ、外部フォントは使っていません)。
- `index.html` の `<meta>` で Content-Security-Policy を指定しています。自サイト以外のスクリプト、通信、フォーム送信を禁止しています。インラインスクリプトは使っていません。`'wasm-unsafe-eval'` は、QR 解析の WebAssembly に必要なため許可しています。フォントの `data:` は、ブラウザ拡張機能が埋め込むフォントがエラーにならないよう許可しています(フォントはスクリプトを実行できません)。
- ユーザーの入力は、`textContent` で表示するか、エスケープしてから使います(SVG のラベル、PDF の文字列)。

## ライセンス

このプロジェクトのコードは [MIT License](LICENSE) です。

同梱しているライブラリと辞書データは、それぞれのライセンスに従います。一覧は [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) を参照してください。

## 商標

QRコードは株式会社デンソーウェーブの登録商標です。
