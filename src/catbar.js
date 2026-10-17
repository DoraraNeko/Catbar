// Catbar: 描画・操作・表情の切り替え
(function (root) {
  'use strict';
  const G = root.CSB.geometry;
  const Lines = root.CSB.lines;

  const BREEDS = ['white', 'black', 'hachiware'];
  const TALK_INTERVAL_MS = 3 * 60 * 1000; // 再生中、この間隔ごとにしゃべる
  const TALK_DURATION_MS = 6000;          // 吹き出しを出しておく時間
  // ページ内で共有する（動画を切り替えても直近5つと被らない）
  const pickLine = Lines.createPicker(Lines.LINES, 5);

  // 猫の種類ごとのフォルダ（assets/<breed>/）にある画像
  const BREED_IMAGES = {
    lower: 'cat-lower.png',
    body: 'cat-body-tile.png',
    normal: 'cat-upper-normal.png',
    wide: 'cat-upper-wide.png',
    closed: 'cat-upper-closed.png',
  };
  // 全種類で共通の画像
  const SHARED_IMAGES = {
    zzz: 'cat-zzz.png',
  };

  // サイトの処理と干渉させないため、猫の上で発生したこれらのイベントは伝播を止める
  const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'contextmenu'];

  class CatBar {
    /**
     * @param {object} opts
     * @param {object} opts.adapter  SiteAdapter
     * @param {(path: string) => string} opts.assetUrl  assets/ からの相対パスから URL を返す関数
     * @param {number} [opts.scale]  表示倍率（整数）
     * @param {string} [opts.breed]  猫の種類（white / black / hachiware）
     * @param {boolean} [opts.talk]  3分ごとにしゃべるか
     * @param {(err: Error) => void} [opts.onError]
     */
    constructor(opts) {
      this.adapter = opts.adapter;
      this.assetUrl = opts.assetUrl;
      this.scale = opts.scale || 1;
      this.breed = BREEDS.includes(opts.breed) ? opts.breed : 'white';
      this.talk = opts.talk !== false;
      this.talkElapsed = 0;
      this.talkLast = 0;
      this.bubbleTimer = 0;
      this.onError = opts.onError || (() => {});
      this.container = null;
      this.video = null;
      this.layout = null;
      this.dragging = false;
      this.dragP = 0;
      this.grabOffset = 0;
      this.face = null;
      this.shown = null;
      this.last = { upperX: NaN, bodyW: NaN, bufW: NaN };
      this.rafId = 0;
      this.seekPending = false;
      this.cleanups = [];
      this.restorePosition = null;
    }

    mount(container, video) {
      this.container = container;
      this.video = video;
      this.build();

      if (getComputedStyle(container).position === 'static') {
        const prev = container.style.position;
        container.style.position = 'relative';
        this.restorePosition = () => { container.style.position = prev; };
      }
      container.appendChild(this.el.root);

      const v = video;
      this.listen(v, 'play', () => { this.updateFace(); this.startLoop(); });
      this.listen(v, 'playing', () => { this.updateFace(); this.startLoop(); });
      this.listen(v, 'pause', () => { this.stopLoop(); this.updateFace(); this.render(); });
      this.listen(v, 'ended', () => { this.stopLoop(); this.updateFace(); this.render(); });
      this.listen(v, 'waiting', () => this.stopLoop());
      this.listen(v, 'seeked', () => { this.updateFace(); this.render(); });
      for (const t of ['timeupdate', 'durationchange', 'loadedmetadata', 'ratechange', 'emptied']) {
        this.listen(v, t, () => { this.evaluate(); this.render(); });
      }
      this.listen(v, 'progress', () => this.render());
      this.listen(document, 'visibilitychange', () => {
        if (document.hidden) this.stopLoop(); else if (!v.paused) this.startLoop();
      });

      this.talkLast = performance.now();
      const talkTimer = setInterval(() => this.guard(() => this.tickTalk()), 1000);
      this.cleanups.push(() => clearInterval(talkTimer));

      const ro = new ResizeObserver(() => this.guard(() => { this.relayout(); this.evaluate(); this.render(true); }));
      ro.observe(container);
      this.cleanups.push(() => ro.disconnect());

      this.relayout();
      this.evaluate();
      this.updateFace();
      this.render(true);
      if (!v.paused) this.startLoop();
    }

    unmount() {
      this.stopLoop();
      clearTimeout(this.bubbleTimer);
      for (const fn of this.cleanups.splice(0)) {
        try { fn(); } catch (_) { /* noop */ }
      }
      if (this.el) this.el.root.remove();
      if (this.restorePosition) this.restorePosition();
      if (this.shown && this.adapter) this.adapter.showNativeBar();
      this.el = null;
      this.container = null;
      this.video = null;
      this.shown = null;
    }

    build() {
      const mk = (cls, parent) => {
        const d = document.createElement('div');
        d.className = cls;
        if (parent) parent.appendChild(d);
        return d;
      };
      const root = mk('csb-root');
      root.dataset.face = 'normal';
      root.hidden = true;
      const el = {
        root,
        track: mk('csb-track', root),
        buffer: mk('csb-buffer', root),
        body: mk('csb-body', root),
        lower: mk('csb-lower', root),
        hit: mk('csb-hit', root),
        upper: mk('csb-upper', root),
        label: mk('csb-label', root),
      };
      el.zzz = mk('csb-zzz', el.upper);
      el.bubble = mk('csb-bubble', el.upper);
      el.bubble.hidden = true;
      el.grab = mk('csb-grab', el.upper);
      el.label.hidden = true;
      this.el = el;

      this.applyImages();

      for (const target of [el.hit, el.grab]) {
        this.listen(target, 'pointerdown', (e) => this.onPointerDown(e));
        this.listen(target, 'pointermove', (e) => this.onPointerMove(e));
        this.listen(target, 'pointerup', (e) => this.onPointerUp(e, true));
        this.listen(target, 'pointercancel', (e) => this.onPointerUp(e, false));
        this.listen(target, 'pointerleave', () => { if (!this.dragging) el.label.hidden = true; });
        for (const t of BLOCKED_EVENTS) this.listen(target, t, (e) => e.stopPropagation());
      }
    }

    listen(target, type, handler) {
      const wrapped = (e) => this.guard(() => handler(e));
      target.addEventListener(type, wrapped);
      this.cleanups.push(() => target.removeEventListener(type, wrapped));
    }

    // 例外が起きたら猫を外して標準バーに戻す
    guard(fn) {
      if (!this.el) return;
      try {
        fn();
      } catch (err) {
        console.error('[cat-seekbar]', err);
        this.unmount();
        this.onError(err);
      }
    }

    // 画像は CSS 変数で渡す（表情の3枚は先読みしてちらつきを防ぐ）
    applyImages() {
      const root = this.el.root;
      root.dataset.breed = this.breed;
      const set = (key, path) => {
        const url = this.assetUrl(path);
        root.style.setProperty(`--csb-img-${key}`, `url("${url}")`);
        new Image().src = url;
      };
      for (const [key, file] of Object.entries(BREED_IMAGES)) set(key, `${this.breed}/${file}`);
      for (const [key, file] of Object.entries(SHARED_IMAGES)) set(key, file);
    }

    setBreed(breed) {
      this.breed = BREEDS.includes(breed) ? breed : 'white';
      this.applyImages();
    }

    setTalk(flag) {
      this.talk = flag;
      if (!flag) this.hideBubble();
    }

    // 再生している時間だけを数え、3分ごとにしゃべる
    tickTalk() {
      const now = performance.now();
      const dt = Math.min(now - this.talkLast, 2000);
      this.talkLast = now;
      const v = this.video;
      if (!this.talk || !this.shown || v.paused || v.ended || document.hidden || this.dragging) return;
      this.talkElapsed += dt;
      if (this.talkElapsed >= TALK_INTERVAL_MS) {
        this.talkElapsed = 0;
        this.say();
      }
    }

    say(text) {
      const v = this.video;
      let line = text;
      for (let i = 0; !line && i < 10; i++) line = Lines.fill(pickLine(), v.currentTime, v.duration, G.formatTime);
      if (!line) return;
      const b = this.el.bubble;
      b.textContent = line;
      b.hidden = false;
      this.bubbleW = b.offsetWidth;
      this.placeBubble(true);
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => this.hideBubble(), TALK_DURATION_MS);
    }

    hideBubble() {
      clearTimeout(this.bubbleTimer);
      if (this.el) this.el.bubble.hidden = true;
    }

    // 吹き出しは頭の右上。バーの右端からはみ出すときは左上に回す
    placeBubble(force) {
      const b = this.el.bubble;
      if (b.hidden) return;
      const L = this.layout;
      const upperX = this.last.upperX;
      const flip = upperX + L.bubbleRightX + this.bubbleW > L.barWidth;
      if (!force && flip === this.bubbleFlip) return;
      this.bubbleFlip = flip;
      b.classList.toggle('csb-bubble-flip', flip);
      b.style.left = `${flip ? L.bubbleLeftX - this.bubbleW : L.bubbleRightX}px`;
    }

    setScale(scale) {
      this.scale = scale;
      this.relayout();
      this.evaluate();
      this.render(true);
    }

    relayout() {
      const c = this.container;
      const L = G.computeLayout(c.clientWidth, this.scale);
      this.layout = L;
      const r = this.el.root.style;
      r.setProperty('--csb-n', String(L.n));
      r.height = `${L.height}px`;
      r.top = `${Math.round(this.adapter.barCenterY(c) - L.bandCenterY)}px`;

      const s = (node, x, y, w, h) => {
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${w}px`;
        node.style.height = `${h}px`;
      };
      const S = G.SPRITE;
      s(this.el.lower, 0, 0, L.lowerW, L.height);
      s(this.el.body, 0, 0, 0, L.height);
      this.el.body.style.backgroundSize = `${L.tileW}px ${L.height}px`;
      s(this.el.upper, 0, 0, L.upperW, L.height);
      // つかめる範囲は上半身の頭〜胴体の帯まで（脚の下の余白はサイトのボタンに譲る）
      s(this.el.grab, L.join, 2 * L.n, L.upperW - L.join, L.bandBottom - 2 * L.n);
      // クリック受付: バー全幅、胴体の帯の少し上から帯の下端まで
      const hitTop = L.bandTop - 4 * L.n;
      s(this.el.hit, 0, hitTop, L.barWidth, L.bandBottom - hitTop);
      // Zzz は頭の左上（耳の左側）に出す
      s(this.el.zzz, -2 * L.n, -6 * L.n, S.zzzW * L.n, S.zzzH * L.n);
      // バーの全体（未読み込みを含む）と読み込み済みの範囲を、胴体の中心の高さに線で描く。
      // 線の右端は、再生位置が最後のときの頭の中心（クリックで飛べる範囲の端）
      const lineTop = Math.round(L.bandCenterY - 2 * L.n);
      const lineLeft = L.lowerW - L.overlap;
      L.lineEnd = G.positionAt(1, L).upperX + L.grabCenter;
      s(this.el.track, lineLeft, lineTop, Math.max(0, L.lineEnd - lineLeft), 4 * L.n);
      s(this.el.buffer, lineLeft, lineTop, 0, 4 * L.n);
      // 吹き出しの根元: 右耳の右上（通常）／左耳の左上（右端に近いとき）
      L.bubbleRightX = (S.upperW - 10) * L.n;
      L.bubbleLeftX = 14 * L.n;
      this.el.bubble.style.bottom = `${L.height - 6 * L.n}px`;
      this.last = { upperX: NaN, bodyW: NaN, bufW: NaN };
    }

    // 猫を出すか、標準バーのままにするかを決める
    evaluate() {
      const v = this.video;
      const ok = G.isPlayableDuration(v.duration)
        && !this.adapter.isLive(v)
        && !this.adapter.isAdPlaying()
        && this.layout && this.layout.visible;
      if (ok === this.shown) return;
      this.shown = ok;
      this.el.root.hidden = !ok;
      if (ok) {
        this.adapter.hideNativeBar();
        this.render(true);
      } else {
        this.adapter.showNativeBar();
        if (this.dragging) this.dragging = false;
      }
    }

    currentP() {
      return this.dragging ? this.dragP : G.ratio(this.video.currentTime, this.video.duration);
    }

    render(force) {
      if (!this.el || !this.shown) return;
      const L = this.layout;
      const pos = G.positionAt(this.currentP(), L);
      if (force || pos.upperX !== this.last.upperX || pos.bodyW !== this.last.bodyW) {
        this.el.upper.style.transform = `translate3d(${pos.upperX}px,0,0)`;
        this.el.body.style.left = `${pos.bodyX}px`;
        this.el.body.style.width = `${pos.bodyW}px`;
        this.last.upperX = pos.upperX;
        this.last.bodyW = pos.bodyW;
        this.placeBubble(force);
      }
      // 読み込み済みの範囲は、胴体の下に薄い線で示す
      const bufP = this.bufferedEnd();
      const bufPos = G.positionAt(bufP, L);
      const bufW = bufP > 0 ? Math.max(0, bufPos.upperX + L.grabCenter - pos.bodyX) : 0;
      if (force || bufW !== this.last.bufW) {
        this.el.buffer.style.width = `${bufW}px`;
        this.last.bufW = bufW;
      }
    }

    bufferedEnd() {
      const v = this.video;
      const b = v.buffered;
      if (!b || !b.length || !G.isPlayableDuration(v.duration)) return 0;
      const t = v.currentTime;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= t + 0.5 && t <= b.end(i) + 0.5) return G.ratio(b.end(i), v.duration);
      }
      return 0;
    }

    updateFace() {
      if (!this.el) return;
      const v = this.video;
      const face = G.decideFace(this.dragging, v.paused || v.ended);
      if (face === this.face) return;
      this.face = face;
      this.el.root.dataset.face = face;
    }

    startLoop() {
      if (this.rafId || document.hidden || !this.el) return;
      const tick = () => {
        this.rafId = 0;
        this.guard(() => {
          this.render();
          if (!this.video.paused && !document.hidden) this.rafId = requestAnimationFrame(tick);
        });
      };
      this.rafId = requestAnimationFrame(tick);
    }

    stopLoop() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    pointerX(e) {
      return e.clientX - this.el.root.getBoundingClientRect().left;
    }

    onPointerDown(e) {
      if (e.button !== 0 || !this.shown) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const x = this.pointerX(e);
      const L = this.layout;
      this.grabOffset = e.currentTarget === this.el.grab
        ? x - G.positionAt(this.currentP(), L).upperX
        : L.grabCenter;
      this.dragging = true;
      this.dragP = G.ratioFromPointer(x, this.grabOffset, L);
      this.updateFace();
      this.showLabel(x);
      this.render();
      this.scheduleSeek();
    }

    onPointerMove(e) {
      if (!this.shown) return;
      const x = this.pointerX(e);
      if (this.dragging) {
        e.stopPropagation();
        this.dragP = G.ratioFromPointer(x, this.grabOffset, this.layout);
        this.render();
        this.scheduleSeek();
        this.showLabel(x);
      } else {
        this.showLabel(x);
      }
    }

    onPointerUp(e, commit) {
      if (!this.dragging) return;
      e.stopPropagation();
      if (commit) this.seekTo(this.dragP);
      this.dragging = false;
      this.updateFace();
      this.render();
      if (!e.currentTarget.matches(':hover')) this.el.label.hidden = true;
    }

    // ドラッグ中のシークは1フレームに1回までにまとめる
    scheduleSeek() {
      if (this.seekPending) return;
      this.seekPending = true;
      requestAnimationFrame(() => {
        this.seekPending = false;
        if (this.dragging && this.el) this.guard(() => this.seekTo(this.dragP));
      });
    }

    seekTo(p) {
      const d = this.video.duration;
      if (!G.isPlayableDuration(d)) return;
      // 終端ぴったりにすると即 ended になるため、わずかに手前に止める
      this.video.currentTime = Math.min(p * d, Math.max(0, d - 0.05));
    }

    // マウス位置の時刻を表示する
    showLabel(x) {
      const L = this.layout;
      const p = this.dragging ? this.dragP : G.ratioFromPointer(x, L.grabCenter, L);
      const label = this.el.label;
      label.textContent = G.formatTime(p * this.video.duration);
      label.hidden = false;
      const w = label.offsetWidth;
      const cx = G.positionAt(p, L).upperX + L.grabCenter;
      label.style.transform = `translate3d(${Math.round(G.clamp(cx - w / 2, 0, L.barWidth - w))}px,0,0)`;
    }
  }

  root.CSB.CatBar = CatBar;
})(globalThis);
