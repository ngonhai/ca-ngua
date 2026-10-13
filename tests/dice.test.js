const D = require('../js/dice.js'); const assert = require('assert');
// orientation maths: identity -> +z up = 3; flipped over x -> -z up = 4; +x axis tilted up -> 1 ...
assert.strictEqual(D.faceUp([1, 0, 0, 0]), 3);
assert.strictEqual(D.faceUp([0, 1, 0, 0]), 4);
const s = Math.SQRT1_2;
assert.strictEqual(D.faceUp([s, 0, -s, 0]), 1, 'rotate -90° about y: +x face goes up');
assert.strictEqual(D.faceUp([s, 0, s, 0]), 6);
assert.strictEqual(D.faceUp([s, s, 0, 0]), 2);
assert.strictEqual(D.faceUp([s, -s, 0, 0]), 5);
for (let i = 0; i < 1000; i++) { const u = D.uniform(); assert.ok(u >= 0 && u < 1); }
// uniformity: chi-square, 5 dof, p=0.001 critical value 20.5
const N = 600000, c = [0, 0, 0, 0, 0, 0, 0];
for (let i = 0; i < N; i++) c[D.roll()]++;
assert.strictEqual(c[0], 0);
const chi = c.slice(1).reduce((a, o) => a + (o - N / 6) ** 2 / (N / 6), 0);
console.log('counts', c.slice(1).join(' '), 'chi2=' + chi.toFixed(2));
assert.ok(chi < 20.5, 'faces are uniform');
// no serial correlation between consecutive rolls (36-cell chi-square, 35 dof, p=0.001 critical 66.6)
const pairs = Array(36).fill(0); let prev = D.roll();
for (let i = 0; i < 360000; i++) { const x = D.roll(); pairs[(prev - 1) * 6 + x - 1]++; prev = x; }
const chi2 = pairs.reduce((a, o) => a + (o - 10000) ** 2 / 10000, 0);
console.log('pairs chi2=' + chi2.toFixed(2)); assert.ok(chi2 < 66.6);
console.log('DICE TESTS PASSED');
