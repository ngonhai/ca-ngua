const L = require('../js/ludo-engine.js'); const assert = require('assert');
const D = require('../js/dice.js');

// ---- play a full game with given bot levels; returns {winner, ev, start}
function play(levels, board, first) {
  const colors = Object.keys(levels);
  const settings = L.normalizeSettings({ board });
  let g = L.newGame(settings, colors, first || colors[0]);
  const start = { settings, colors, first: g.turn };
  let ev = '>', guard = 0;
  while (g.phase !== 'over' && guard++ < 20000) {
    if (g.phase === 'roll') { const v = D.roll(); g = L.roll(g, v); ev += v; }
    else if (g.phase === 'penalty') { const p = L.botLose(g, g.turn); g = L.losePawn(g, p); ev += 'abcd'[p]; }
    else { const p = L.botChoose(g, g.turn, levels[g.turn]); g = L.move(g, p); ev += 'abcd'[p]; }
  }
  assert.ok(g.phase === 'over', 'game finished');
  return { g, ev, start };
}

// ---- replay reproduces the game exactly (both boards, mixed levels)
for (let t = 0; t < 60; t++) {
  const levels = t % 2 ? { red: 'easy', yellow: 'hard' } : { red: 'hard', green: 'normal', blue: 'easy' };
  const { g, ev, start } = play(levels, L.BOARD_IDS[t % 2]);
  const r = L.replayStates({ settings: start.settings, colors: start.colors, first: start.first, ev });
  const last = r.states[r.states.length - 1];
  assert.deepStrictEqual(last.pawns, g.pawns); assert.deepStrictEqual(last.ranking, g.ranking); assert.strictEqual(last.winner, g.winner);
  assert.strictEqual(r.states.length, r.steps.length + 1);
  // garbage / truncated input never throws
  L.replayStates({ settings: start.settings, colors: start.colors, first: start.first, ev: ev.slice(0, ev.length >> 1) + 'zz9!' });
}
assert.strictEqual(L.replayStates({ settings: {}, colors: ['red', 'blue'], first: 'red', ev: '>' }).states.length, 1);
console.log('replay reproduces 60 games');

// ---- difficulty ordering (2-player duels, colours/first player alternate to cancel bias)
function duel(a, b, N) {
  let wa = 0;
  for (let i = 0; i < N; i++) {
    const swap = i % 2, levels = swap ? { red: b, yellow: a } : { red: a, yellow: b };
    const r = play(levels, L.BOARD_IDS[(i >> 1) % 2], (i >> 2) % 2 ? 'red' : 'yellow');
    if (levels[r.g.winner] === a && (swap ? r.g.winner === 'yellow' : r.g.winner === 'red')) wa++;
  }
  return wa / N;
}
const N = 2400;
const hn = duel('hard', 'normal', N), ne = duel('normal', 'easy', N), he = duel('hard', 'easy', N);
console.log('hard vs normal', hn.toFixed(3), '| normal vs easy', ne.toFixed(3), '| hard vs easy', he.toFixed(3));
assert.ok(hn > 0.505, 'hard beats normal'); assert.ok(ne > 0.65, 'normal beats easy'); assert.ok(he > 0.68, 'hard crushes easy');
console.log('BOTS + REPLAY TESTS PASSED');
