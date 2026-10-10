// 実行: node --test tests/lines.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { LINES, createPicker, fill } = require('../src/lines.js');
const { formatTime } = require('../src/geometry.js');

test('セリフは重複なく十分な数がある', () => {
  assert.ok(LINES.length >= 50);
  assert.equal(new Set(LINES).size, LINES.length);
});

test('直近5つのセリフとは被らない', () => {
  const pick = createPicker(LINES, 5);
  const seen = [];
  for (let i = 0; i < 5000; i++) {
    const line = pick();
    assert.ok(!seen.slice(-5).includes(line), `${i}回目で直近と被った: ${line}`);
    seen.push(line);
  }
});

test('乱数が偏っても直近と被らない', () => {
  const pick = createPicker(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 5, () => 0);
  const seen = Array.from({ length: 30 }, () => pick());
  for (let i = 5; i < seen.length; i++) assert.ok(!seen.slice(i - 5, i).includes(seen[i]));
});

test('セリフが少なくても止まらない', () => {
  const pick = createPicker(['a', 'b'], 5);
  const seen = Array.from({ length: 10 }, () => pick());
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1]);
});

test('{time} と {left} を置き換える', () => {
  assert.equal(fill('いま{time}、残り{left}', 65, 600, formatTime), 'いま1:05、残り8:55');
  assert.equal(fill('残り{left}', 10, Infinity, formatTime), null);
  assert.equal(fill('いま{time}', 10, NaN, formatTime), 'いま0:10');
});
