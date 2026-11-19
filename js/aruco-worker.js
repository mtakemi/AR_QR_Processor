// Module worker: runs ArUco / AprilTag detection off the main thread.
import { detectMarkers, loadDictionary } from './aruco.js';
import { getLang, setLang } from './i18n.js';

self.onmessage = async (e) => {
  const { reqId, imageData, opts, lang } = e.data;
  try {
    if (lang && lang !== getLang()) setLang(lang, { persist: false });
    await loadDictionary(opts.dictionary || 'AUTO');
    const t0 = performance.now();
    const markers = detectMarkers(imageData, opts);
    self.postMessage({ reqId, markers, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ reqId, error: String(err && err.message ? err.message : err) });
  }
};
