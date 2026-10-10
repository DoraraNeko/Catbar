// 実行: node --test tests/geometry.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/geometry.js');

const W = 800;

for (const n of [1, 2, 3]) {
  test(`n=${n}: p=0 で下半身と上半身が隣り合う`, () => {
    const L = G.computeLayout(W, n);
    const pos = G.positionAt(0, L);
    // 上半身の胴体の帯の左端 = 下半身の右端
    assert.equal(pos.upperX + L.join, L.lowerW);
  });

  test(`n=${n}: p=1 で上半身の右端がバーの右端`, () => {
    const L = G.computeLayout(W, n);
    const pos = G.positionAt(1, L);
    assert.equal(pos.upperX + L.upperW, W);
  });

  test(`n=${n}: 胴体は下半身と上半身に1ドットずつ重なる`, () => {
    const L = G.computeLayout(W, n);
    for (const p of [0, 0.3, 1]) {
      const pos = G.positionAt(p, L);
      assert.equal(pos.bodyX, L.lowerW - n);
      assert.equal(pos.bodyX + pos.bodyW, pos.upperX + L.join + n);
    }
  });
}

test('範囲外の p は 0〜1 に丸められる', () => {
  const L = G.computeLayout(W, 2);
  assert.deepEqual(G.positionAt(-0.5, L), G.positionAt(0, L));
  assert.deepEqual(G.positionAt(1.5, L), G.positionAt(1, L));
  assert.equal(G.ratio(-1, 100), 0);
  assert.equal(G.ratio(150, 100), 1);
});

test('L が 0 以下のときは非表示', () => {
  const s = G.SPRITE;
  const minW = s.upperW + s.lowerW - s.upperJoinX;
  assert.equal(G.computeLayout(minW, 1).visible, false);
  assert.equal(G.computeLayout(minW + 1, 1).visible, true);
  assert.equal(G.computeLayout(100, 3).visible, false);
});

test('座標→p と p→座標が往復して一致する', () => {
  const L = G.computeLayout(1000, 2);
  for (const p of [0, 0.123, 0.5, 0.999, 1]) {
    const x = L.startX + p * L.L + L.grabCenter;
    assert.ok(Math.abs(G.ratioFromPointer(x, L.grabCenter, L) - p) < 1e-9);
  }
});

test('再生率: 長さが不定なら 0', () => {
  assert.equal(G.ratio(10, NaN), 0);
  assert.equal(G.ratio(10, Infinity), 0);
  assert.equal(G.ratio(10, 0), 0);
  assert.equal(G.ratio(25, 100), 0.25);
});

test('decideFace: ドラッグ中 > 一時停止中 > 通常', () => {
  assert.equal(G.decideFace(true, true), 'wide');
  assert.equal(G.decideFace(true, false), 'wide');
  assert.equal(G.decideFace(false, true), 'closed');
  assert.equal(G.decideFace(false, false), 'normal');
});

test('formatTime', () => {
  assert.equal(G.formatTime(0), '0:00');
  assert.equal(G.formatTime(65.9), '1:05');
  assert.equal(G.formatTime(3725), '1:02:05');
  assert.equal(G.formatTime(NaN), '0:00');
});
