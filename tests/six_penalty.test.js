// House rule: 3 sixes = roll again, 4th = lose 1 pawn, 5th = 2, 6th = roll again, 7th = 3, 8th = 4.
// Plus: a 6 that cannot be played still gives another roll.
const L = require('../js/ludo-engine.js'); const assert = require('assert');
const mk = (o, colors) => L.newGame(Object.assign({ board: 'classic', noJump: false, homeGate: false, needSix: false, sixPenalty: true }, o), colors || ['red', 'yellow'], 'red');
const onField = (g, c) => g.pawns[c].filter(p => p >= 0 && p < L.boardOf(g).FINISH).length;

// 6 on the move: roll 6, move pawn, roll 6, move pawn  -> 2 sixes done, still red's turn, sixes counter kept
let g = mk({}); g.pawns.red = [10, 20, 30, 40];
g = L.roll(g, 6); assert.strictEqual(g.phase, 'move'); g = L.move(g, 0);
g = L.roll(g, 6); g = L.move(g, 0); assert.strictEqual(g.sixes, 2);
// 3rd six: void, roll again, nothing moved, nobody lost
const before = JSON.stringify(g.pawns);
g = L.roll(g, 6); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(g.turn, 'red'); assert.strictEqual(JSON.stringify(g.pawns), before);
// 4th six: lose one -> 4 pawns on field = must choose
g = L.roll(g, 6); assert.strictEqual(g.phase, 'penalty'); assert.strictEqual(g.turn, 'red');
assert.strictEqual(L.move(g, 0), g, 'cannot move during penalty');
assert.strictEqual(L.roll(g, 3), g, 'cannot roll during penalty');
assert.deepStrictEqual(L.penaltyPawns(g, 'red'), [0, 1, 2, 3]);
let g2 = L.losePawn(g, 2); assert.strictEqual(g2.pawns.red[2], -1); assert.strictEqual(onField(g2, 'red'), 3);
assert.strictEqual(g2.phase, 'roll'); assert.strictEqual(g2.turn, 'red'); assert.strictEqual(g2.lossSeq, 1); assert.strictEqual(g2.lastLoss.pawn, 2);
assert.strictEqual(L.losePawn(g, 9), g, 'bad index'); assert.strictEqual(L.losePawn(g2, 0), g2, 'not in penalty');
g = g2;
// 5th six: lose another
g = L.roll(g, 6); assert.strictEqual(g.phase, 'penalty'); g = L.losePawn(g, L.botLose(g, 'red')); assert.strictEqual(onField(g, 'red'), 2);
// 6th: roll again, 7th: lose, 8th: lose  -> total 4
g = L.roll(g, 6); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(onField(g, 'red'), 2);
g = L.roll(g, 6); assert.strictEqual(g.phase, 'penalty'); g = L.losePawn(g, L.botLose(g, 'red')); assert.strictEqual(onField(g, 'red'), 1);
// 8th: only ONE pawn on the field -> lost automatically, no choice
g = L.roll(g, 6); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(onField(g, 'red'), 0); assert.strictEqual(g.lossSeq, 4);
// 9th: nothing left to lose -> just roll again
g = L.roll(g, 6); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(g.lossSeq, 4);
// a non-6 resets the count and the turn goes on normally
g = L.roll(g, 2); assert.strictEqual(g.sixes, 0);

// single pawn on the field: automatic loss, no choice (others in base / finished don't count)
g = mk({}); g.pawns.red = [-1, 7, 55 + 1, -1].map(p => p === 56 ? L.BOARDS.classic.FINISH : p); g.sixes = 3;
g = L.roll(g, 6); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(g.pawns.red[1], -1); assert.strictEqual(g.pawns.red[2], L.BOARDS.classic.FINISH, 'finished pawn is safe');
// no pawns on the field: nothing lost
g = mk({}); g.pawns.red = [-1, -1, -1, -1]; g.sixes = 3; g = L.roll(g, 6); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(g.lossSeq, 0);
// several pawns on the very same progress: no real choice -> automatic
g = mk({ noJump: false }); g.pawns.red = [9, 9, -1, -1]; g.sixes = 3; g = L.roll(g, 6); assert.strictEqual(g.phase, 'roll'); assert.strictEqual(onField(g, 'red'), 1);
// pawns in the home lane can be chosen too
g = mk({}); g.pawns.red = [53, 10, -1, -1]; g.sixes = 3; g = L.roll(g, 6); assert.strictEqual(g.phase, 'penalty'); assert.deepStrictEqual(L.penaltyPawns(g, 'red'), [0, 1]);
// bot gives up its least advanced pawn
assert.strictEqual(L.botLose(g, 'red'), 1);

// rule off: old behaviour (maxSixes) — and the setting really replaces it
g = mk({ sixPenalty: false, maxSixes: 3 }); g.pawns.red = [10, 20, 30, 40];
g = L.roll(g, 6); g = L.move(g, 0); g = L.roll(g, 6); g = L.move(g, 0); g = L.roll(g, 6); assert.strictEqual(g.turn, 'yellow');
g = mk({ sixExtra: false }); g.pawns.red = [10, 20, 30, 40]; g = L.roll(g, 6); g = L.move(g, 0); assert.strictEqual(g.turn, 'yellow', 'no sixExtra -> no chain at all');

// a 6 that cannot be played still rolls again (was: lost the turn)
// exact finish: every pawn needs 1, a 6 can't be played
g = mk({ sixPenalty: false, exactFinish: true }); g.pawns.red = [55, 55, 55, 55];
g = L.roll(g, 6); assert.strictEqual(g.turn, 'red'); assert.strictEqual(g.phase, 'roll', 'unplayable 6 -> roll again');
g = L.roll(g, 6); assert.strictEqual(g.turn, 'red', 'and again');
g = L.roll(g, 4); assert.strictEqual(g.turn, 'yellow', 'unplayable non-6 still passes');
g = mk({ sixExtra: false, sixPenalty: false, exactFinish: true }); g.pawns.red = [55, 55, 55, 55]; g = L.roll(g, 6); assert.strictEqual(g.turn, 'yellow', 'sixExtra off: pass');
// with the penalty on, the stuck 6 keeps counting (4th six stuck -> penalty applies)
g = mk({ exactFinish: true }); g.pawns.red = [55, 54, 53, 52]; g.sixes = 3; g = L.roll(g, 6); assert.strictEqual(g.phase, 'penalty', 'a stuck 6 still counts toward the penalty (4 pawns on the field -> choice)');

// replay: choices are recorded as letters and rebuilt exactly
// red: 6a 2a (pawn0 at 2), yellow 3,3,3 (passes), red: 6b 6b (pawn1 at 6), 6 (3rd: void), 6 (4th: choice) + 'a' = give up pawn 0
{
  const settings = L.normalizeSettings({ board: 'classic', needSix: true, noJump: false, homeGate: false, sixPenalty: true });
  const rp = L.replayStates({ settings, colors: ['red', 'yellow'], first: 'red', ev: '6a2a3336b6b66a' });
  const last = rp.states[rp.states.length - 1];
  assert.strictEqual(last.lossSeq, 1); assert.strictEqual(last.pawns.red[0], -1); assert.strictEqual(last.pawns.red[1], 6);
  assert.ok(rp.steps.some(s => s.lost), 'step is flagged as a loss');
  assert.strictEqual(last.turn, 'red'); assert.strictEqual(last.phase, 'roll');
}

// fuzz: random games finish with the rule on, both boards, penalties of every kind happen
let pens = 0, again = 0;
for (let t = 0; t < 300; t++) {
  let gg = L.newGame({ board: L.BOARD_IDS[t % 2], pawns: 1 + t % 4, needSix: t % 3 !== 0, sixPenalty: true }, t % 2 ? ['red', 'yellow'] : ['red', 'green', 'blue']), n = 0;
  while (gg.phase !== 'over' && n++ < 40000) {
    gg = L.roll(gg, Math.random() < 0.35 ? 6 : 1 + Math.floor(Math.random() * 6));
    if (gg.phase === 'penalty') { pens++; gg = L.losePawn(gg, L.botLose(gg, gg.turn)); }
    if (gg.phase === 'move') gg = L.move(gg, L.botChoose(gg, gg.turn));
    gg.order.forEach(c => gg.pawns[c].forEach(p => assert.ok(p >= -1 && p <= L.boardOf(gg).FINISH)));
  }
  assert.strictEqual(gg.phase, 'over', 'game finishes with six penalty on');
}
assert.ok(pens > 0);
console.log('SIX PENALTY TESTS PASSED (' + pens + ' penalty choices in fuzz)');
