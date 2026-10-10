// Catbar: 座標計算と表情の判定（DOM に依存しない純関数）
(function (root) {
  'use strict';

  // 素材の寸法（基準サイズ、px）。素材を差し替えるときはここを合わせる
  const SPRITE = {
    height: 40,     // 全パーツ共通の高さ
    lowerW: 20,     // 下半身の幅（右端 x=19 で胴体の帯に接続）
    upperW: 40,     // 上半身の幅
    tileW: 4,       // 胴体タイルの幅
    upperJoinX: 8,  // 上半身の胴体の帯が始まる x（左側は透明の余白）
    bandTop: 20,    // 胴体の帯の上端の行
    bandBottom: 31, // 胴体の帯の下端の行
    zzzW: 16,
    zzzH: 14,
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function isPlayableDuration(d) {
    return Number.isFinite(d) && d > 0;
  }

  // 再生率 p
  function ratio(currentTime, duration) {
    if (!isPlayableDuration(duration)) return 0;
    return clamp(currentTime / duration, 0, 1);
  }

  // バー幅 W と倍率 n から、表示寸法を求める
  function computeLayout(barWidth, scale, sprite) {
    const s = sprite || SPRITE;
    const n = Math.max(1, Math.round(scale));
    const lowerW = s.lowerW * n;
    const upperW = s.upperW * n;
    const join = s.upperJoinX * n;
    const startX = lowerW - join;          // p=0 のときの上半身の左端
    const L = barWidth - upperW - startX;  // 上半身の移動距離
    return {
      n,
      barWidth,
      height: s.height * n,
      lowerW,
      upperW,
      tileW: s.tileW * n,
      join,
      overlap: n,                          // 継ぎ目を隠す重なり（1ドット）
      startX,
      L,
      visible: L > 0,
      bandTop: s.bandTop * n,
      bandBottom: (s.bandBottom + 1) * n,
      bandCenterY: ((s.bandTop + s.bandBottom + 1) / 2) * n,
      grabCenter: ((s.upperJoinX + s.upperW) / 2) * n, // 上半身の見た目の中心
    };
  }

  // p から各パーツの位置を求める（整数 px に丸めてドットを揃える）
  function positionAt(p, layout) {
    const q = clamp(p, 0, 1);
    const upperX = Math.round(layout.startX + q * Math.max(0, layout.L));
    const bodyX = layout.lowerW - layout.overlap;
    const bodyW = upperX + layout.join + layout.overlap - bodyX;
    return { p: q, upperX, bodyX, bodyW };
  }

  // ポインター位置から p を逆算する
  function ratioFromPointer(pointerX, grabOffset, layout) {
    if (layout.L <= 0) return 0;
    return clamp((pointerX - grabOffset - layout.startX) / layout.L, 0, 1);
  }

  // 表情: ドラッグ中 ＞ 一時停止中 ＞ 通常
  function decideFace(dragging, paused) {
    if (dragging) return 'wide';
    if (paused) return 'closed';
    return 'normal';
  }

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }

  const api = {
    SPRITE, clamp, isPlayableDuration, ratio, computeLayout, positionAt,
    ratioFromPointer, decideFace, formatTime,
  };
  root.CSB = Object.assign(root.CSB || {}, { geometry: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
