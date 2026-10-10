// Twitch 用アダプター（VOD とクリップ）。セレクタは実機で未確認
(function (root) {
  'use strict';

  const SEL = {
    video: '.video-player video, [data-a-target="video-player"] video',
    container: '[data-a-target="player-seekbar"]',
  };

  // VOD: /videos/<id>、クリップ: /<channel>/clip/<slug> または clips.twitch.tv
  function isRecordedPage(location) {
    return /^\/videos\/\d+/.test(location.pathname) || /\/clip\//.test(location.pathname)
      || location.hostname === 'clips.twitch.tv';
  }

  const twitch = {
    name: 'twitch',

    matches(location) {
      return /(^|\.)twitch\.tv$/.test(location.hostname) && isRecordedPage(location);
    },

    findVideo() {
      return document.querySelector(SEL.video);
    },

    findBarContainer() {
      return document.querySelector(SEL.container);
    },

    barCenterY(container) {
      return container.clientHeight / 2;
    },

    hideNativeBar() {
      const c = this.findBarContainer();
      if (c) c.classList.add('csb-hide-native');
    },

    showNativeBar() {
      for (const el of document.querySelectorAll('.csb-hide-native')) el.classList.remove('csb-hide-native');
    },

    isLive(video) {
      return !Number.isFinite(video.duration) || !isRecordedPage(location);
    },

    isAdPlaying() {
      return !!document.querySelector('[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"]');
    },

    // Twitch はページ内遷移のイベントがないため、URL の変化を定期的に比較する
    watchNavigation(callback) {
      let last = location.href;
      const id = setInterval(() => {
        if (location.href !== last) {
          last = location.href;
          callback();
        }
      }, 1000);
      return () => clearInterval(id);
    },
  };

  root.CSB = root.CSB || {};
  root.CSB.adapters = Object.assign(root.CSB.adapters || {}, { twitch });
})(globalThis);
