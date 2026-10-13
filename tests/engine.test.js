const L = require('../js/ludo-engine.js');
const assert = require('assert');

// --- geometry sanity
assert.strictEqual(L.TRACK_XY.length, 52);
const seen = new Set(L.TRACK_XY.map(p => p.join(',')));
assert.strictEqual(seen.size, 52, 'track cells unique');
for (let i = 0; i < 52; i++) {
  const a = L.TRACK_XY[i], b = L.TRACK_XY[(i + 1) % 52];
  assert.strictEqual(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])), 1, 'adjacent ' + i);
}
assert.deepStrictEqual(L.TRACK_XY[L.START.red], [1, 6]);
assert.deepStrictEqual(L.TRACK_XY[L.START.green], [8, 1]);
assert.deepStrictEqual(L.TRACK_XY[L.START.yellow], [13, 8]);
assert.deepStrictEqual(L.TRACK_XY[L.START.blue], [6, 13]);
// last track tile of each colour is adjacent to first lane tile
L.COLORS.forEach(c => {
  const last = L.TRACK_XY[L.trackIdx(c, 50)], lane0 = L.LANE_XY[c][0];
  assert.strictEqual(Math.abs(last[0] - lane0[0]) + Math.abs(last[1] - lane0[1]), 1, c + ' lane join');
});

// mechanics tests isolate one rule at a time, so the two newer house rules start OFF here
const mk = (o, colors) => { const g = L.newGame(Object.assign({ board: 'classic', noJump: false, homeGate: false, sixPenalty: false }, o), colors || ['red', 'yellow'], 'red'); return g; };
const setDie = (g, d) => { const x = L.clone(g); x.phase = 'move'; x.die = d; return x; };

// --- needSix
let g = mk({}); g = L.roll(g, 3); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(g.tries, 2);
g = L.roll(g, 2); g = L.roll(g, 4); assert.strictEqual(g.turn, 'yellow', 'pass after 3 fails');
g = mk({}); g = L.roll(g, 6); assert.strictEqual(g.phase, 'move');
g = L.move(g, 0); assert.strictEqual(g.pawns.red[0], 0); assert.strictEqual(g.turn, 'red'); assert.strictEqual(g.phase, 'roll', '6 = extra');

// --- no-six rule: any number enters
g = mk({ needSix: false }); g = L.roll(g, 2); assert.strictEqual(g.phase, 'move'); g = L.move(g, 0); assert.strictEqual(g.pawns.red[0], 0); assert.strictEqual(g.turn, 'yellow');

// --- capture on/off, safe tiles
function arrange(settings) {
  const g = mk(settings);
  g.pawns.red = [5, -1, -1, -1];            // red idx 6
  g.pawns.yellow = [-1, -1, -1, -1];
  g.pawns.yellow[0] = 31;                    // yellow idx (27+31)%52=6
  return g;
}
let a = arrange({}); a = setDie(a, 1); a.turn = 'red';
// red at p5 (idx6), move 1 -> idx7; need enemy at idx7: set yellow p32
a.pawns.yellow[0] = 32; // idx 7
let r = L.move(a, 0); assert.strictEqual(r.pawns.yellow[0], -1, 'captured'); assert.strictEqual(r.turn, 'red', 'capture extra');
a = arrange({ capture: false }); a.pawns.yellow[0] = 32; a = setDie(a, 1); a.turn = 'red';
r = L.move(a, 0); assert.strictEqual(r.pawns.yellow[0], 32, 'no capture when off'); assert.strictEqual(r.turn, 'yellow');
// safe tile: idx 9 is a star
a = arrange({}); a.pawns.red = [7, -1, -1, -1]; a.pawns.yellow[0] = 9 - 27 + 52; // idx 9
a = setDie(a, 2); a.turn = 'red'; // red p7 idx 8 -> p9 idx 10? compute: idx=(1+7)=8 ; +2 => 10. want 9
a.pawns.red = [7, -1, -1, -1]; a = setDie(a, 1); a.turn = 'red';
assert.strictEqual(L.trackIdx('red', 8), 9);
r = L.move(a, 0); assert.strictEqual(r.pawns.yellow[0], a.pawns.yellow[0], 'safe star keeps enemy');
a.settings.safeTiles = false; r = L.move(a, 0); assert.strictEqual(r.pawns.yellow[0], -1, 'unsafe captures');

// --- blockade
a = mk({ blockade: true, noJump: false }); a.pawns.red = [0, -1, -1, -1];             // idx1
a.pawns.yellow = [0, 0, -1, -1];                                       // idx 27 x2
a.pawns.red[0] = 24; // idx 25
a = setDie(a, 3); a.turn = 'red';
assert.strictEqual(L.evalMove(a, 'red', 0, 3), null, 'blocked passing idx27');
assert.ok(L.evalMove(a, 'red', 0, 1), 'can approach');
a.settings.blockade = false; assert.ok(L.evalMove(a, 'red', 0, 3));

// --- exact finish / bounce
a = mk({}); a.pawns.red = [54, -1, -1, -1]; assert.strictEqual(L.evalMove(a, 'red', 0, 3), null);
assert.ok(L.evalMove(a, 'red', 0, 2)?.finishes);
a.settings.exactFinish = false; assert.strictEqual(L.evalMove(a, 'red', 0, 4), null); const bm = L.evalMove(a, 'red', 0, 3); assert.strictEqual(bm.to, 55); // 57 bounces to 55
a.pawns.red = [53, -1, -1, -1]; assert.strictEqual(L.evalMove(a, 'red', 0, 5).to, 54);

// --- three sixes
g = mk({}); g.pawns.red = [10, 10, 10, 10];
g = L.roll(g, 6); g = L.move(g, 0); g = L.roll(g, 6); g = L.move(g, 0); g = L.roll(g, 6);
assert.strictEqual(g.turn, 'yellow', '3 sixes forfeits');
g = mk({ maxSixes: 0 }); g.pawns.red = [10, 10, 10, 10];
for (let k = 0; k < 4; k++) { g = L.roll(g, 6); g = L.move(g, 0); } assert.strictEqual(g.turn, 'red');

// --- winning, modes
g = mk({ pawns: 1 }); g.pawns.red = [55]; g = L.roll(g, 1); g = L.move(g, 0);
assert.strictEqual(g.phase, 'over'); assert.strictEqual(g.winner, 'red');
g = mk({ pawns: 1, finishMode: 'ranking' }, ['red', 'yellow', 'blue']); g.pawns.red = [55]; g.pawns.yellow = [55];
g = L.roll(g, 1); g = L.move(g, 0); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(g.turn, 'yellow');
g = L.roll(g, 1); g = L.move(g, 0); assert.strictEqual(g.phase, 'over'); assert.deepStrictEqual(g.ranking, ['red', 'yellow', 'blue']);

// --- fuzz: complete games under many setting combos
let finished = 0, total = 0;
const bools = ['capture', 'safeTiles', 'needSix', 'triesWhenStuck', 'sixExtra', 'captureExtra', 'homeExtra', 'exactFinish', 'blockade', 'noJump', 'homeGate'];
for (let t = 0; t < 400; t++) {
  const s = {};
  bools.forEach(k => s[k] = Math.random() < 0.5);
  s.board = L.BOARD_IDS[t % 2]; s.maxSixes = [0, 3][t % 2]; s.pawns = 1 + (t % 4); s.finishMode = t % 3 ? 'first' : 'ranking';
  const colors = L.COLORS.filter(() => Math.random() < 0.7); if (colors.length < 2) colors.push('red', 'blue');
  let gg = L.newGame(s, [...new Set(colors)]);
  let steps = 0;
  while (gg.phase !== 'over' && steps++ < 60000) {
    gg = L.roll(gg, 1 + Math.floor(Math.random() * 6));
    if (gg.phase === 'penalty') gg = L.losePawn(gg, L.botLose(gg, gg.turn));
    if (gg.phase === 'move') {
      const pick = L.botChoose(gg, gg.turn);
      assert.ok(pick !== null);
      gg = L.move(gg, pick);
    }
    // invariants
    gg.order.forEach(c => gg.pawns[c].forEach(p => assert.ok(p >= -1 && p <= L.boardOf(gg).FINISH)));
  }
  total++; if (gg.phase === 'over') finished++;
  if (gg.phase !== 'over') console.log('stuck game', JSON.stringify(s), gg.pawns, gg.turn);
}
console.log(`fuzz: ${finished}/${total} games finished`);
assert.strictEqual(finished, total);
console.log('ALL ENGINE TESTS PASSED');
