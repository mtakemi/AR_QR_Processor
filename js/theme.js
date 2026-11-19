// Runs in <head> before first paint (classic script): applies the saved / system colour theme,
// and the UI language so English visitors do not see the Japanese markup flash.
(function () {
  var root = document.documentElement;
  var t = null;
  try {
    t = localStorage.getItem('theme');
  } catch (e) {}
  if (t !== 'dark' && t !== 'light') {
    t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-bs-theme', t);

  var lang = null;
  try {
    lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('lang');
  } catch (e) {}
  if (lang === 'en') {
    root.lang = 'en';
    // hidden until js/i18n.js has translated the page (fallback: show anyway)
    root.classList.add('i18n-pending');
    setTimeout(function () {
      root.classList.remove('i18n-pending');
    }, 1500);
  }
})();
