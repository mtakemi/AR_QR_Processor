// Minimal i18n: Japanese (default) and English.
// Works in the page, in workers and in Node (tests): DOM / storage access is guarded.
//
// HTML: <span data-i18n="key"> sets textContent,
//       data-i18n-attr="title:key;aria-label:key2" sets attributes.
// JS:   t('key', { name: value }) — entries are strings with {name} placeholders or functions.

export const LANGS = { ja: '日本語', en: 'English' };
const DEFAULT_LANG = 'ja';

const ja = {
  'meta.description': 'ARマーカー(ArUco / AprilTag)とQRコードの生成・画像解析をブラウザだけで行うツール',
  'nav.privacy': '画像はブラウザ内でのみ処理されます',
  'nav.themeTitle': 'ライト / ダーク切り替え',
  'nav.themeAria': 'テーマ切り替え',
  'nav.langAria': '表示言語',
  'common.copy': 'コピー',
  'common.copyImage': '画像をコピー',
  'common.tryAnalyze': '解析してみる',
  'common.borderBits': '黒枠ビット数',
  'common.cellPx': '1セルのpx',
  'common.auto': '自動',
  'common.close': '閉じる',
  'common.copied': 'コピーしました',
  'common.copyFailed': 'コピーできませんでした',
  'common.imageCopied': '画像をクリップボードにコピーしました',
  'common.imageCopyUnsupported': 'このブラウザでは画像のコピーに対応していません',
  'common.loadingDict': '辞書データを読み込み中…',

  // analysis
  'an.title': '画像解析',
  'an.file': '画像を選択',
  'an.paste': 'クリップボードから',
  'an.camera': 'カメラで読み取り',
  'an.clear': 'クリア',
  'an.dropAria': '画像のドロップ領域',
  'an.hint1': '画像をドロップ / クリックして選択 / ',
  'an.hint2': ' で貼り付け',
  'an.hintSub': 'QRコード・Micro QR・rMQR と ArUco / AprilTag マーカーを検出します(1枚に複数あっても可)',
  'an.resultAria': '解析結果',
  'an.settings': '検出設定',
  'an.optQR': 'QRコード',
  'an.optMarker': 'ARマーカー',
  'an.optInverted': '白黒反転マーカーも',
  'an.optDict': 'マーカー辞書',
  'an.results': '検出結果',
  'an.notYet': 'まだ解析していません。',
  'an.analyzing': '解析中…',
  'an.noneLive': 'カメラにQRコードやマーカーを映してください。',
  'an.none': '検出されませんでした。画像の解像度やピント、設定(辞書・反転)を確認してください。',
  'an.imageInfo': '{label} — {w}×{h}px',
  'an.downscaled': '({w}×{h}px に縮小して解析)',
  'an.loadFailed': '画像を読み込めませんでした(対応していない形式の可能性があります)',
  'an.dropImage': '画像ファイルをドロップしてください',
  'an.pasted': '貼り付けた画像',
  'an.clipboardImage': 'クリップボードの画像',
  'an.captured': 'カメラから取り込んだ画像',
  'an.generatedQR': '生成したQRコード',
  'an.generatedMarker': '生成したマーカー',
  'an.pasteUnsupported': 'このブラウザはボタンからの読み込みに未対応です。Ctrl+V(⌘+V)で貼り付けてください',
  'an.noClipboardImage': 'クリップボードに画像がありません',
  'an.clipboardFailed': 'クリップボードを読み取れませんでした。Ctrl+V(⌘+V)で貼り付けてください',
  'an.markerError': 'ARマーカー検出でエラー: {msg}',
  'an.qrFileProtocol': 'QR解析ライブラリ(WASM)は file:// では読み込めません。HTTP サーバー経由で開いてください。',
  'an.qrError': 'QR解析でエラー: {msg}',

  // results
  'res.qr': 'QRコード',
  'res.version': 'バージョン {v}',
  'res.ecl': '誤り訂正 {v}',
  'res.mirrored': '鏡像',
  'res.inverted': '反転',
  'res.empty': '(空のデータ)',
  'res.openLink': 'リンクを開く',
  'res.dict': '辞書: {v}',
  'res.corrected': '{n} ビット訂正',
  'res.invertedMarker': '白黒反転',
  'res.alternatives': '他の辞書とも一致: {v}',
  'res.corners': '四隅 (左上から時計回り): {v}',

  // camera
  'cam.select': 'カメラ選択',
  'cam.capture': '静止画にして詳しく解析',
  'cam.stop': 'カメラ停止',
  'cam.unavailable': 'この環境ではカメラを使用できません(HTTPS 接続が必要です)',
  'cam.denied': 'カメラの使用が許可されませんでした',
  'cam.notFound': 'カメラが見つかりませんでした',
  'cam.failed': 'カメラを開始できませんでした: {msg}',
  'cam.live': 'カメラ映像をリアルタイムで解析中(カメラ停止で終了します)',
  'cam.device': 'カメラ {n}',
  'cam.perFrame': '{ms} ms / フレーム',

  // dictionaries
  'dict.auto': '自動(すべての辞書から探す)',
  'dict.groupAruco': 'ArUco(OpenCV 定義済み)',
  'dict.groupArucoOther': 'ArUco その他',
  'dict.groupApril': 'AprilTag(classic: 16h5〜36h11)',
  'dict.groupAT3': 'AprilTag 3(Standard / Circle / Custom)',
  'dict.option': '{name}({n}個)',

  // QR generation
  'qr.title': 'QRコード生成',
  'qr.data': 'データ',
  'qr.count': '{c} 文字 / {b} バイト(UTF-8)',
  'qr.mode': 'エンコードモード',
  'qr.modeAuto': '自動(最適分割)',
  'qr.modeNumeric': '数字 (Numeric)',
  'qr.modeAlphanumeric': '英数字 (Alphanumeric)',
  'qr.modeByte': 'バイト (Byte / UTF-8)',
  'qr.modeKanji': '漢字 (Kanji / Shift_JIS)',
  'qr.segNumeric': '数字',
  'qr.segAlphanumeric': '英数字',
  'qr.segByte': 'バイト',
  'qr.segKanji': '漢字',
  'qr.ecl': '誤り訂正レベル',
  'qr.eclL': 'L(約7%復元)',
  'qr.eclM': 'M(約15%復元)',
  'qr.eclQ': 'Q(約25%復元)',
  'qr.eclH': 'H(約30%復元)',
  'qr.version': 'バージョン',
  'qr.mask': 'マスク',
  'qr.margin': '余白(セル)',
  'qr.dark': '前景色',
  'qr.light': '背景色',
  'qr.previewAria': 'QRコードのプレビュー',
  'qr.info': 'バージョン {v}({s}×{s}セル)/ 誤り訂正 {e} / マスク {m} / セグメント: {seg} / 画像 {px}×{px}px',
  'qr.warnInverted': '前景色が背景色より明るい(反転)QRは、読み取れないリーダーがあります。',
  'qr.warnContrast': '前景色と背景色のコントラストが低いため、読み取りにくい可能性があります。',
  'qr.warnMargin': '規格上の推奨余白は 4 セル以上です(Micro QR は 2 セル)。',
  'qr.errEmpty': 'データを入力してください',
  'qr.errVersion': 'バージョン {v} には収まりません(必要なバージョン: {min} 以上)',
  'qr.errTooBig': 'データ量が多すぎて QR コードに収まりません',
  'qr.errMode': '選択したモード「{mode}」で表せない文字が含まれています',

  // marker generation
  'mk.title': 'ARマーカー生成(ArUco / AprilTag)',
  'mk.dict': '辞書',
  'mk.random': 'ランダム',
  'mk.randomAria': 'ランダムなID',
  'mk.quiet': '白余白(セル)',
  'mk.mm': 'SVG印刷(mm)',
  'mk.mmPlaceholder': '指定なし',
  'mk.mmTitle': '検出される四隅の間の一辺の長さ(mm)。ArUco/classic AprilTag は黒枠の外側、AprilTag 3 は白枠の外側',
  'mk.label': '下に辞書名とIDを表示',
  'mk.previewAria': 'ARマーカーのプレビュー',
  'mk.idRange': '(0〜{max})',
  'mk.borderAT3': 'AprilTag 3 は枠の構造がファミリーで決まっているため指定できません',
  'mk.infoAT3': '{tw}×{tw}セル / データ {bits}ビット・最小ハミング距離 {h} / 検出枠 {d}×{d}セル(白余白込み {t}×{t})/ PNG {w}×{hh}px',
  'mk.info': '{m}×{m}ビット + 黒枠{b} = {d}×{d}セル(白余白込み {t}×{t})/ PNG {w}×{hh}px',
  'mk.infoMm': ' / SVG: {basis} {mm}mm(1セル {cell}mm)',
  'mk.basisAT3': '検出枠(白枠の外周)',
  'mk.basisOuter': '黒枠外寸',
  'mk.infoUnused': ' / 未使用セル(透明部分)は白で出力',
  'mk.warnQuiet': '白余白が 0 の場合、背景が暗いと検出できないことがあります。印刷時は周囲に白い余白を確保してください。',
  'mk.errId': 'ID は 0〜{max} の範囲で指定してください',
  'mk.errNotLoaded': '{family} のデータが読み込まれていません(loadDictionary を先に呼んでください)',

  // batch
  'b.title': '一括生成(印刷用 PDF)',
  'b.desc': '上で選んだ辞書・黒枠・白余白の設定で、複数の ID を A4 / A3 に並べた PDF を作ります。各マーカーは必須の白余白を個別に持つので、点線で切り取っても余白が確保されます。',
  'b.ids': 'ID',
  'b.idsPlaceholder': '例: 1-5 / 1,2-4,7',
  'b.paper': '用紙',
  'b.orient': '向き',
  'b.portrait': '縦',
  'b.landscape': '横',
  'b.basis': 'サイズの基準',
  'b.basisDetect': '検出枠(姿勢推定で使うマーカー長)',
  'b.basisOuter': 'マーカー外寸(白余白を除く)',
  'b.mm': 'サイズ mm',
  'b.mmTitle': 'ArUco / classic AprilTag の検出枠は黒枠の外側、AprilTag 3 は白枠の外側',
  'b.margin': '用紙余白',
  'b.gap': '枠の間隔 mm',
  'b.gapTitle': '切り取り枠どうしの間隔。0 なら隣の枠と切り取り線を共有します',
  'b.cut': '切り取り線(点線)で白余白ごと囲む',
  'b.label': '辞書名と ID を印字(枠内・白余白の外)',
  'b.previewAria': '印刷レイアウトのプレビュー(1ページ目)',
  'b.pdf': 'PDF をダウンロード',
  'b.noFit': (p) => `${p.mm} mm のマーカーは ${p.paper} に 1 個も収まりません。サイズ・用紙余白を小さくしてください${p.paper === 'A4' ? '(または A3 に変更)' : ''}。`,
  'b.info': (p) =>
    `${p.n} 個 / 1ページに最大 ${p.per} 個(${p.cols}列 × ${p.rows}行)/ 検出枠 ${p.det} mm・外寸 ${p.outer} mm・1セル ${p.cell} mm / ` +
    `切り取りサイズ ${p.tw} × ${p.th} mm(白余白 ${p.q} mm${p.label ? '+ラベル' : ''}込み)`,
  'b.warnPages': '1枚に入りきりません({n} 個のうち、1枚に入るのは {per} 個まで)。このまま出力すると {pages} ページの PDF になります。1枚に収めるには、サイズ・余白・間隔を小さくするか、用紙・向きを変更してください。',
  'b.warnCell': '1セルが {cell} mm と小さいため、印刷のにじみで検出しにくくなる可能性があります。',
  'b.warnQuiet': '白余白が 0 のため、切り取ると黒枠の周りに白い部分が残らず、背景によっては検出できなくなります。白余白は 1 セル以上を推奨します。',
  'b.toastPages': '{pages} ページの PDF を出力しました(1枚に入りきらなかったため)',
  'b.errEmpty': 'ID を入力してください(例: 1-5 / 1,2-4,7)',
  'b.errParse': '「{t}」を解釈できません(例: 1-5 / 1,2-4,7)',
  'b.errRange': 'ID {id} は範囲外です(この辞書は 0〜{max})',
  'b.errTooMany': '一度に生成できるのは {max} 個までです',
  'b.errTooManyN': '一度に生成できるのは {max} 個までです(指定: {n} 個)',

  // footer
  'foot.left': 'AR / QR Processor — 静的ページ / すべての処理はブラウザ内で完結',
  'foot.right': '使用ライブラリ: Bootstrap, Bootstrap Icons, node-qrcode, zxing-wasm(zxing-cpp)/ 辞書データ: OpenCV, AprilTag 3',
  'foot.trademark': 'QRコードは株式会社デンソーウェーブの登録商標です。',
};

const en = {
  'meta.description': 'Generate and analyze AR markers (ArUco / AprilTag) and QR codes entirely in your browser',
  'nav.privacy': 'Images are processed only in your browser',
  'nav.themeTitle': 'Toggle light / dark',
  'nav.themeAria': 'Toggle theme',
  'nav.langAria': 'Language',
  'common.copy': 'Copy',
  'common.copyImage': 'Copy image',
  'common.tryAnalyze': 'Analyze it',
  'common.borderBits': 'Border bits',
  'common.cellPx': 'Pixels per cell',
  'common.auto': 'Auto',
  'common.close': 'Close',
  'common.copied': 'Copied',
  'common.copyFailed': 'Could not copy',
  'common.imageCopied': 'Image copied to the clipboard',
  'common.imageCopyUnsupported': 'This browser does not support copying images',
  'common.loadingDict': 'Loading dictionary data…',

  'an.title': 'Image analysis',
  'an.file': 'Choose image',
  'an.paste': 'From clipboard',
  'an.camera': 'Scan with camera',
  'an.clear': 'Clear',
  'an.dropAria': 'Image drop area',
  'an.hint1': 'Drop an image, click to choose one, or paste with ',
  'an.hint2': '',
  'an.hintSub': 'Detects QR codes, Micro QR, rMQR and ArUco / AprilTag markers (several per image are fine)',
  'an.resultAria': 'Analysis result',
  'an.settings': 'Detection settings',
  'an.optQR': 'QR codes',
  'an.optMarker': 'AR markers',
  'an.optInverted': 'Also inverted markers',
  'an.optDict': 'Marker dictionary',
  'an.results': 'Results',
  'an.notYet': 'Nothing analyzed yet.',
  'an.analyzing': 'Analyzing…',
  'an.noneLive': 'Point the camera at a QR code or marker.',
  'an.none': 'Nothing detected. Check the image resolution and focus, and the settings (dictionary, inverted).',
  'an.imageInfo': '{label} — {w}×{h}px',
  'an.downscaled': ' (analyzed at {w}×{h}px)',
  'an.loadFailed': 'Could not load the image (the format may not be supported)',
  'an.dropImage': 'Please drop an image file',
  'an.pasted': 'Pasted image',
  'an.clipboardImage': 'Clipboard image',
  'an.captured': 'Camera capture',
  'an.generatedQR': 'Generated QR code',
  'an.generatedMarker': 'Generated marker',
  'an.pasteUnsupported': 'This browser cannot read the clipboard from a button. Paste with Ctrl+V (⌘+V) instead',
  'an.noClipboardImage': 'There is no image in the clipboard',
  'an.clipboardFailed': 'Could not read the clipboard. Paste with Ctrl+V (⌘+V) instead',
  'an.markerError': 'AR marker detection failed: {msg}',
  'an.qrFileProtocol': 'The QR decoder (WASM) cannot be loaded from file://. Open the page through an HTTP server.',
  'an.qrError': 'QR decoding failed: {msg}',

  'res.qr': 'QR code',
  'res.version': 'Version {v}',
  'res.ecl': 'EC level {v}',
  'res.mirrored': 'Mirrored',
  'res.inverted': 'Inverted',
  'res.empty': '(empty data)',
  'res.openLink': 'Open link',
  'res.dict': 'Dictionary: {v}',
  'res.corrected': '{n} bit(s) corrected',
  'res.invertedMarker': 'Inverted',
  'res.alternatives': 'Also matches: {v}',
  'res.corners': 'Corners (clockwise from top-left): {v}',

  'cam.select': 'Select camera',
  'cam.capture': 'Capture a still for detailed analysis',
  'cam.stop': 'Stop camera',
  'cam.unavailable': 'The camera is not available here (an HTTPS connection is required)',
  'cam.denied': 'Camera access was not allowed',
  'cam.notFound': 'No camera was found',
  'cam.failed': 'Could not start the camera: {msg}',
  'cam.live': 'Analyzing the camera feed in real time (press Stop camera to end)',
  'cam.device': 'Camera {n}',
  'cam.perFrame': '{ms} ms / frame',

  'dict.auto': 'Auto (search all dictionaries)',
  'dict.groupAruco': 'ArUco (OpenCV predefined)',
  'dict.groupArucoOther': 'ArUco, other',
  'dict.groupApril': 'AprilTag (classic: 16h5–36h11)',
  'dict.groupAT3': 'AprilTag 3 (Standard / Circle / Custom)',
  'dict.option': '{name} ({n})',

  'qr.title': 'QR code generator',
  'qr.data': 'Data',
  'qr.count': '{c} characters / {b} bytes (UTF-8)',
  'qr.mode': 'Encoding mode',
  'qr.modeAuto': 'Auto (optimal segments)',
  'qr.modeNumeric': 'Numeric',
  'qr.modeAlphanumeric': 'Alphanumeric',
  'qr.modeByte': 'Byte (UTF-8)',
  'qr.modeKanji': 'Kanji (Shift_JIS)',
  'qr.segNumeric': 'Numeric',
  'qr.segAlphanumeric': 'Alphanumeric',
  'qr.segByte': 'Byte',
  'qr.segKanji': 'Kanji',
  'qr.ecl': 'Error correction level',
  'qr.eclL': 'L (~7% recovery)',
  'qr.eclM': 'M (~15% recovery)',
  'qr.eclQ': 'Q (~25% recovery)',
  'qr.eclH': 'H (~30% recovery)',
  'qr.version': 'Version',
  'qr.mask': 'Mask',
  'qr.margin': 'Quiet zone (cells)',
  'qr.dark': 'Foreground',
  'qr.light': 'Background',
  'qr.previewAria': 'QR code preview',
  'qr.info': 'Version {v} ({s}×{s} cells) / EC level {e} / Mask {m} / Segments: {seg} / Image {px}×{px}px',
  'qr.warnInverted': 'Some readers cannot read inverted QR codes (foreground lighter than background).',
  'qr.warnContrast': 'The contrast between foreground and background is low, so the code may be hard to read.',
  'qr.warnMargin': 'The standard recommends a quiet zone of at least 4 cells (2 for Micro QR).',
  'qr.errEmpty': 'Please enter some data',
  'qr.errVersion': 'The data does not fit in version {v} (version {min} or higher is required)',
  'qr.errTooBig': 'Too much data to fit in a QR code',
  'qr.errMode': 'The data contains characters that the selected mode "{mode}" cannot represent',

  'mk.title': 'AR marker generator (ArUco / AprilTag)',
  'mk.dict': 'Dictionary',
  'mk.random': 'Random',
  'mk.randomAria': 'Random ID',
  'mk.quiet': 'White margin (cells)',
  'mk.mm': 'SVG print (mm)',
  'mk.mmPlaceholder': 'Not set',
  'mk.mmTitle': 'Side length between the detected corners (mm). Outside the black border for ArUco / classic AprilTag, outside the white border for AprilTag 3',
  'mk.label': 'Show dictionary name and ID below',
  'mk.previewAria': 'AR marker preview',
  'mk.idRange': '(0–{max})',
  'mk.borderAT3': 'Not adjustable for AprilTag 3: the border layout is fixed by the family',
  'mk.infoAT3': '{tw}×{tw} cells / {bits} data bits, min. Hamming distance {h} / detection frame {d}×{d} cells ({t}×{t} with margin) / PNG {w}×{hh}px',
  'mk.info': '{m}×{m} bits + border {b} = {d}×{d} cells ({t}×{t} with margin) / PNG {w}×{hh}px',
  'mk.infoMm': ' / SVG: {basis} {mm}mm ({cell}mm per cell)',
  'mk.basisAT3': 'detection frame (outside of white border)',
  'mk.basisOuter': 'black border outer size',
  'mk.infoUnused': ' / unused (transparent) cells are drawn white',
  'mk.warnQuiet': 'With a white margin of 0, the marker may not be detected on a dark background. Leave white space around it when printing.',
  'mk.errId': 'The ID must be between 0 and {max}',
  'mk.errNotLoaded': 'The data for {family} has not been loaded (call loadDictionary first)',

  'b.title': 'Batch generation (printable PDF)',
  'b.desc': 'Creates a PDF with several IDs laid out on A4 / A3, using the dictionary, border and white margin chosen above. Each marker keeps its own white margin, so the margin remains when you cut along the dotted lines.',
  'b.ids': 'IDs',
  'b.idsPlaceholder': 'e.g. 1-5 / 1,2-4,7',
  'b.paper': 'Paper',
  'b.orient': 'Orientation',
  'b.portrait': 'Portrait',
  'b.landscape': 'Landscape',
  'b.basis': 'Size refers to',
  'b.basisDetect': 'Detection frame (marker length for pose estimation)',
  'b.basisOuter': 'Marker outer size (without white margin)',
  'b.mm': 'Size (mm)',
  'b.mmTitle': 'The detection frame is outside the black border for ArUco / classic AprilTag, and outside the white border for AprilTag 3',
  'b.margin': 'Page margin',
  'b.gap': 'Gap (mm)',
  'b.gapTitle': 'Space between cut boxes. With 0, neighbouring boxes share a cut line',
  'b.cut': 'Dotted cut line around each marker and its margin',
  'b.label': 'Print dictionary name and ID (inside the box, outside the margin)',
  'b.previewAria': 'Print layout preview (page 1)',
  'b.pdf': 'Download PDF',
  'b.noFit': (p) => `A ${p.mm} mm marker does not fit on ${p.paper}. Reduce the size or the page margin${p.paper === 'A4' ? ' (or switch to A3)' : ''}.`,
  'b.info': (p) =>
    `${p.n} marker(s) / up to ${p.per} per page (${p.cols} columns × ${p.rows} rows) / detection frame ${p.det} mm, outer ${p.outer} mm, ${p.cell} mm per cell / ` +
    `cut size ${p.tw} × ${p.th} mm (incl. ${p.q} mm white margin${p.label ? ' and label' : ''})`,
  'b.warnPages': 'Does not fit on one page (only {per} of {n} fit per page). As is, the PDF will have {pages} pages. To fit on one page, reduce the size, margin or gap, or change the paper or orientation.',
  'b.warnCell': 'Cells are only {cell} mm, so ink bleed may make the markers hard to detect.',
  'b.warnQuiet': 'With a white margin of 0, no white remains around the border after cutting, and detection may fail depending on the background. A margin of 1 cell or more is recommended.',
  'b.toastPages': 'Created a {pages}-page PDF (the markers did not fit on one page)',
  'b.errEmpty': 'Please enter IDs (e.g. 1-5 / 1,2-4,7)',
  'b.errParse': 'Cannot understand "{t}" (e.g. 1-5 / 1,2-4,7)',
  'b.errRange': 'ID {id} is out of range (this dictionary has 0–{max})',
  'b.errTooMany': 'Up to {max} markers can be generated at once',
  'b.errTooManyN': 'Up to {max} markers can be generated at once (requested: {n})',

  'foot.left': 'AR / QR Processor — static page, everything runs in your browser',
  'foot.right': 'Libraries: Bootstrap, Bootstrap Icons, node-qrcode, zxing-wasm (zxing-cpp) / Dictionary data: OpenCV, AprilTag 3',
  'foot.trademark': 'QR Code is a registered trademark of DENSO WAVE INCORPORATED.',
};

const DICTS = { ja, en };
const listeners = new Set();

function initialLang() {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('lang');
    if (q && q in DICTS) return q;
  } catch {}
  try {
    const s = globalThis.localStorage?.getItem('lang');
    if (s && s in DICTS) return s;
  } catch {}
  return DEFAULT_LANG;
}

let lang = initialLang();

export function getLang() {
  return lang;
}

export function t(key, params = {}) {
  const v = DICTS[lang][key] ?? ja[key];
  if (v === undefined) return key;
  if (typeof v === 'function') return v(params);
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Translate data-i18n / data-i18n-attr elements under root. */
export function applyI18n(root = globalThis.document) {
  if (!root) return;
  for (const e of root.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
  for (const e of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of e.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) e.setAttribute(attr, t(key));
    }
  }
  const doc = globalThis.document;
  if (doc && root === doc) {
    doc.documentElement.lang = lang;
    doc.documentElement.classList.remove('i18n-pending');
    doc.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  }
}

/** Change the language; `persist` saves it for the next visit. Listeners re-render dynamic text. */
export function setLang(next, { persist = true } = {}) {
  if (!(next in DICTS)) return;
  lang = next;
  if (persist) {
    try {
      globalThis.localStorage?.setItem('lang', next);
    } catch {}
  }
  applyI18n();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
}
