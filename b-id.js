/**
 * B! ID クライアント
 * 各サービスのHTMLに <script src="https://ユーザー名.github.io/b-id/b-id.js"></script> を1行足して使う
 *
 *   BID.requireLogin().then(function (user) { ...ログイン済みの処理... });
 *   BID.user();    // ログイン中のユーザー (未ログインなら null)
 *   BID.token();   // サービス側のサーバーで確認したいときに渡すトークン
 *   BID.logout();
 */
(function () {
  // ▼ 自分の環境に合わせて書き換える
  var LOGIN_URL = 'https://bainarinoakaunto.github.io/b-id/login/';
  var API_URL   = 'https://script.google.com/macros/s/AKfycbxwYlQ7zvHMY9W5X4nCTytMUfYuYAlnTKwRZEjnjNGzGgdTmFyHUg7kyIDaizxU6GNs/exec';
  // ▲

  var KEY = 'bid_session';
  var RECHECK_MS = 10 * 60 * 1000; // 10分以内に確認済みなら再確認しない
  var current = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    current = null;
  }

  // text/plain で送ると、ブラウザの事前確認(CORS preflight)が不要になる
  function api(body) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  // URLの #bid_token=... を取り出し、アドレスバーから消す
  function takeTokenFromUrl() {
    var m = location.hash.match(/(?:^#|&)bid_token=([A-Za-z0-9]+)/);
    if (!m) return null;
    history.replaceState(null, '', location.pathname + location.search);
    return m[1];
  }

  function goLogin() {
    var back = location.origin + location.pathname + location.search;
    location.replace(LOGIN_URL + '?redirect=' + encodeURIComponent(back));
  }

  var ready = (function () {
    var fresh = takeTokenFromUrl();
    var saved = load();
    var token = fresh || (saved && saved.token);
    if (!token) return Promise.resolve(null);

    if (!fresh && saved && saved.user && Date.now() - saved.checkedAt < RECHECK_MS) {
      current = saved;
      return Promise.resolve(saved.user);
    }
    return api({ action: 'verify', token: token }).then(function (res) {
      if (!res.ok) { clear(); return null; }
      current = { token: token, user: res.user, checkedAt: Date.now() };
      save(current);
      return res.user;
    }).catch(function () {
      // 通信エラー時は、前回確認済みの情報があればそれを使う
      if (saved && saved.user) { current = saved; return saved.user; }
      return null;
    });
  })();

  window.BID = {
    ready: ready,
    requireLogin: function () {
      return ready.then(function (user) {
        if (user) return user;
        goLogin();
        return new Promise(function () {}); // 移動するので完了しない
      });
    },
    user: function () { return current ? current.user : null; },
    token: function () { return current ? current.token : null; },
    login: goLogin,
    logout: function () {
      var t = current && current.token;
      clear();
      return (t ? api({ action: 'logout', token: t }) : Promise.resolve()).catch(function () {});
    }
  };
})();