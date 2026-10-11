// YouTube 用アダプター（サイトの画面構造に依存する部分はここにまとめる）
(function (root) {
  'use strict';

  // 通常の動画（/watch）とショート（/shorts/<id>）で、プレーヤーの作りが違う
  const SEL = {
    watch: {
      player: '#movie_player',
      video: '#movie_player video.html5-main-video',
      container: '#movie_player .ytp-progress-bar-container',
      nativeBar: '.ytp-progress-bar',
    },
    // ショートのバー（yt-progress-bar）はマウスを重ねたときしか見えないため、
    // 猫はその外側の枠に付けて常に表示する
    shorts: {
      player: '#shorts-player',
      video: '#shorts-player video',
      container: '.desktopShortsPlayerControlsHost',
      nativeBar: 'yt-progress-bar',
    },
  };

  function mode(location) {
    if (!/(^|\.)youtube\.com$/.test(location.hostname)) return null;
    if (location.pathname === '/watch') return 'watch';
    if (/^\/shorts\/[^/]+/.test(location.pathname)) return 'shorts';
    return null;
  }

  function sel() {
    return SEL[mode(location) || 'watch'];
  }

  // 見えている要素を優先する（ショートは前後の動画の枠が残っていることがある）
  function findVisible(selector) {
    const all = document.querySelectorAll(selector);
    for (const el of all) if (el.getBoundingClientRect().width > 0) return el;
    return all[0] || null;
  }

  const youtube = {
    name: 'youtube',

    matches(location) {
      return mode(location) !== null;
    },

    findVideo() {
      return document.querySelector(sel().video);
    },

    findBarContainer() {
      return findVisible(sel().container);
    },

    // 標準バーの中心線（取り付け先の上端からの距離）
    barCenterY(container) {
      const bar = container.querySelector(sel().nativeBar) || container;
      const c = container.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      return b.top - c.top + b.height / 2;
    },

    hideNativeBar() {
      const c = this.findBarContainer();
      if (c) c.classList.add('csb-hide-native');
      const p = document.querySelector(sel().player);
      if (p) p.classList.add('csb-player-active');
    },

    showNativeBar() {
      for (const el of document.querySelectorAll('.csb-hide-native')) el.classList.remove('csb-hide-native');
      for (const el of document.querySelectorAll('.csb-player-active')) el.classList.remove('csb-player-active');
    },

    isLive(video) {
      if (!Number.isFinite(video.duration)) return true;
      const p = document.querySelector(sel().player);
      return !!(p && p.classList.contains('ytp-live'));
    },

    isAdPlaying() {
      const p = document.querySelector(sel().player);
      return !!(p && (p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting')));
    },

    watchNavigation(callback) {
      const handler = () => callback();
      document.addEventListener('yt-navigate-finish', handler);
      return () => document.removeEventListener('yt-navigate-finish', handler);
    },
  };

  root.CSB = root.CSB || {};
  root.CSB.adapters = Object.assign(root.CSB.adapters || {}, { youtube });
})(globalThis);
