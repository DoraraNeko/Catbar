// YouTube 用アダプター（サイトの画面構造に依存する部分はここにまとめる）
(function (root) {
  'use strict';

  const SEL = {
    player: '#movie_player',
    video: '#movie_player video.html5-main-video',
    container: '#movie_player .ytp-progress-bar-container',
    nativeBar: '.ytp-progress-bar',
  };

  const youtube = {
    name: 'youtube',

    matches(location) {
      return /(^|\.)youtube\.com$/.test(location.hostname) && location.pathname === '/watch';
    },

    findVideo() {
      return document.querySelector(SEL.video);
    },

    findBarContainer() {
      return document.querySelector(SEL.container);
    },

    // 標準バーの中心線（取り付け先の上端からの距離）
    barCenterY(container) {
      const bar = container.querySelector(SEL.nativeBar) || container;
      const c = container.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      return b.top - c.top + b.height / 2;
    },

    hideNativeBar() {
      const c = this.findBarContainer();
      if (c) c.classList.add('csb-hide-native');
      const p = document.querySelector(SEL.player);
      if (p) p.classList.add('csb-player-active');
    },

    showNativeBar() {
      for (const el of document.querySelectorAll('.csb-hide-native')) el.classList.remove('csb-hide-native');
      for (const el of document.querySelectorAll('.csb-player-active')) el.classList.remove('csb-player-active');
    },

    isLive(video) {
      if (!Number.isFinite(video.duration)) return true;
      const p = document.querySelector(SEL.player);
      return !!(p && p.classList.contains('ytp-live'));
    },

    isAdPlaying() {
      const p = document.querySelector(SEL.player);
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
