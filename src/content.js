// Catbar: 起動、サイト判定、ON/OFF の反映
(function () {
  'use strict';
  const { CatBar, adapters } = globalThis.CSB;

  const adapter = /(^|\.)youtube\.com$/.test(location.hostname) ? adapters.youtube
    : /(^|\.)twitch\.tv$/.test(location.hostname) ? adapters.twitch : null;
  if (!adapter) return;

  const DEFAULTS = { enabled: true, scale: 1, breed: 'white', talk: true };
  const WAIT_MS = 10000;
  let settings = { ...DEFAULTS };
  let bar = null;
  let waitTimer = 0;
  let failed = false; // 例外で外れた場合、次のページ遷移までは付け直さない

  const assetUrl = (path) => chrome.runtime.getURL(`assets/${path}`);

  function detach() {
    clearTimeout(waitTimer);
    if (bar) bar.unmount();
    bar = null;
    adapter.showNativeBar();
  }

  // video と取り付け先が揃うまで最大10秒待ってから取り付ける
  function attach() {
    detach();
    if (!settings.enabled || !adapter.matches(location)) return;
    const started = Date.now();
    const tryMount = () => {
      const video = adapter.findVideo();
      const container = adapter.findBarContainer();
      if (video && container) {
        bar = new CatBar({
          adapter,
          assetUrl,
          scale: settings.scale,
          breed: settings.breed,
          talk: settings.talk,
          onError: () => { bar = null; failed = true; },
        });
        bar.mount(container, video);
        return;
      }
      if (Date.now() - started < WAIT_MS) waitTimer = setTimeout(tryMount, 250);
    };
    tryMount();
  }

  // サイトが取り付け先や video を作り直したら付け直す（Twitch 対策、YouTube の動画切り替えにも有効）
  setInterval(() => {
    if (!settings.enabled) return;
    if (!adapter.matches(location)) {
      if (bar) detach();
      return;
    }
    if (bar) {
      if (!bar.container || !bar.container.isConnected || bar.video !== adapter.findVideo()
        || bar.container !== adapter.findBarContainer()) attach();
    } else if (!failed && adapter.findVideo() && adapter.findBarContainer()) {
      attach();
    }
  }, 1000);

  adapter.watchNavigation(() => {
    failed = false;
    attach();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const prev = { ...settings };
    for (const [k, { newValue }] of Object.entries(changes)) {
      if (k in DEFAULTS) settings[k] = newValue ?? DEFAULTS[k];
    }
    if (settings.enabled !== prev.enabled || !bar) {
      settings.enabled ? attach() : detach();
    } else if (bar) {
      if (settings.scale !== prev.scale) bar.setScale(settings.scale);
      if (settings.breed !== prev.breed) bar.setBreed(settings.breed);
      if (settings.talk !== prev.talk) bar.setTalk(settings.talk);
    }
  });

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    attach();
  });
})();
