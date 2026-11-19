// esbuild entry: bundles node-qrcode (MIT) for browser use as window.QRLib
const QRCode = require('qrcode/lib/core/qrcode');
const toSJIS = require('qrcode/helper/to-sjis');
module.exports = { create: QRCode.create, toSJIS };
