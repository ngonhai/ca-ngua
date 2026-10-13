// Tests for the two "house" rules: noJump (parent rule) and homeGate.
const L = require('../js/ludo-engine.js'); const assert = require('assert');
const mk = (o, colors) => L.newGame(Object.assign({ board: 'classic', pawns: 2, needSix: false, capture: true, safeTiles: false, blockade: false, homeGate: false, noJump: true }, o), colors || ['red', 'yellow'], 'red');
const setup = (o, red, yellow) => { const g = mk(o); g.pawns.red = red; g.pawns.yellow = yellow; return g; };
// red p5 = track idx 6;  yellow p33 = idx 8 (27+33=60%52) ; yellow p31 = idx 6 ; yellow p34 = idx 9 (a star)

// ---- noJump: pass / stop behind / kick
let g = setup({}, [5, -1], [33, -1]);
assert.ok(L.evalMove(g, 'red', 0, 1), 'stop behind');
assert.strictEqual(L.evalMove(g, 'red', 0, 2).captures.length, 1, 'land exactly = kick');
assert.strictEqual(L.evalMove(g, 'red', 0, 3), null, 'pass = illegal');
assert.ok(L.evalMove(setup({ noJump: false }, [5, -1], [33, -1]), 'red', 0, 3), 'rule off = may jump');

// ---- PARENT RULE: it overrides every rule that would let pawns share a cell
g = setup({ capture: false }, [5, -1], [33, -1]);
assert.strictEqual(L.evalMove(g, 'red', 0, 2), null, 'capture OFF: cannot land on a pawn (no sharing)');
assert.ok(L.evalMove(setup({ capture: false, noJump: false }, [5, -1], [33, -1]), 'red', 0, 2), 'noJump off + capture off: sharing allowed');
g = setup({ safeTiles: true }, [7, -1], [34, -1]);                       // enemy on a star (safe)
assert.strictEqual(L.trackIdx('yellow', 34), 9); assert.strictEqual(L.trackIdx('red', 8), 9);
assert.strictEqual(L.evalMove(g, 'red', 0, 1), null, 'safe tile: cannot kick, so cannot land');
assert.ok(L.evalMove(setup({ safeTiles: true, noJump: false }, [7, -1], [34, -1]), 'red', 0, 1), 'noJump off: sharing a safe tile allowed');
g = setup({}, [5, 7], [-1, -1]);
assert.strictEqual(L.evalMove(g, 'red', 0, 2), null, 'cannot land on own pawn');
assert.strictEqual(L.evalMove(g, 'red', 0, 3), null, 'cannot pass own pawn');
assert.ok(L.evalMove(g, 'red', 0, 1), 'stop behind own pawn');
// two enemy pawns on one cell (only possible if the rule was off earlier): landing kicks both, passing is blocked
g = setup({ blockade: true }, [5, -1], [33, 33]);
assert.strictEqual(L.evalMove(g, 'red', 0, 3), null);
assert.strictEqual(L.evalMove(g, 'red', 0, 2).captures.length, 2, 'kicks the whole stack when capture is on');
// leaving base onto an occupied start tile
g = setup({ needSix: true }, [-1, 0], [-1, -1]); g.die = 6;
assert.strictEqual(L.evalMove(g, 'red', 0, 6), null, 'own pawn on start tile blocks leaving base');
g = setup({ needSix: true, safeTiles: true }, [-1, -1], [26, -1]); // yellow p26 = idx 1 = red start
assert.strictEqual(L.trackIdx('yellow', 26), 1);
assert.strictEqual(L.evalMove(g, 'red', 0, 6).captures.length, 1, 'enemy on MY start tile is kicked when I leave base (start tiles are safe only for their owner)');
assert.ok(L.evalMove(setup({ needSix: true, safeTiles: false }, [-1, -1], [26, -1]), 'red', 0, 6).captures.length === 1, 'unsafe start tile: kicks');
// home lane is private but still no sharing / passing own pawns there
g = setup({}, [50, 52], [-1, -1]);
assert.strictEqual(L.evalMove(g, 'red', 0, 3), null, 'cannot pass own pawn in the lane');
assert.strictEqual(L.evalMove(g, 'red', 0, 2), null, 'cannot land on own pawn in the lane');
assert.ok(L.evalMove(g, 'red', 0, 1));
// the finish cell can hold many pawns
g = setup({}, [55, 56], [-1, -1]); assert.ok(L.evalMove(g, 'red', 0, 1).finishes);
g = setup({}, [50, 50], [-1, -1]); // (impossible state but harmless) finishing past nobody
assert.ok(L.evalMove(setup({}, [50, 56], [-1, -1]), 'red', 0, 6));

// ---- blockade has no extra effect while noJump is on (in states reachable with noJump on)
function shareFree(gg) {
  const seen = new Set();
  for (const c of gg.order) for (const p of gg.pawns[c]) {
    if (p < 0 || p >= L.FINISH) continue;
    const key = p <= L.LAST_TRACK ? 't' + L.trackIdx(c, p) : 'l' + c + p;
    assert.ok(!seen.has(key), 'two pawns share a cell: ' + key); seen.add(key);
  }
}
let compared = 0;
for (let t = 0; t < 120; t++) {
  const a = mk({ pawns: 3, blockade: true, safeTiles: t % 2 === 0, capture: t % 3 !== 0, needSix: t % 4 === 0 }, ['red', 'green', 'yellow', 'blue']);
  let gg = a;
  for (let n = 0; n < 400 && gg.phase !== 'over'; n++) {
    gg = L.roll(gg, 1 + Math.floor(Math.random() * 6));
    if (gg.phase === 'penalty') gg = L.losePawn(gg, L.botLose(gg, gg.turn));
    if (gg.phase === 'move') {
      const off = L.clone(gg); off.settings.blockade = false;
      const A = L.legalMoves(gg, gg.turn, gg.die).map(m => m.pawn + ':' + m.to + ':' + m.captures.length).join();
      const B = L.legalMoves(off, off.turn, off.die).map(m => m.pawn + ':' + m.to + ':' + m.captures.length).join();
      assert.strictEqual(A, B, 'blockade must not change anything while noJump is on'); compared++;
      gg = L.move(gg, L.botChoose(gg, gg.turn));
    }
    shareFree(gg);                                    // NO cell is ever shared while noJump is on
  }
}
console.log('blockade/noJump equivalence checked on', compared, 'positions; no shared cells ever');

// ---- homeGate
g = setup({ homeGate: true, noJump: false }, [47, -1], [-1, -1]);
assert.strictEqual(L.evalMove(g, 'red', 0, 4), null, '47+4 would run straight into the lane');
assert.strictEqual(L.evalMove(g, 'red', 0, 6), null);
assert.ok(L.evalMove(g, 'red', 0, 3), 'exactly onto the gate tile (progress 50)');
assert.ok(L.evalMove(g, 'red', 0, 1));
assert.strictEqual(L.evalMove(g, 'red', 0, 3).to, L.LAST_TRACK);
g = setup({ homeGate: true, noJump: false }, [50, -1], [-1, -1]);
assert.strictEqual(L.evalMove(g, 'red', 0, 1).to, 51, 'from the gate tile you step into the lane');
assert.ok(L.evalMove(g, 'red', 0, 6).finishes, 'gate -> finish with the exact roll');
assert.strictEqual(L.evalMove(g, 'red', 0, 4).to, 54);
g = setup({ homeGate: false, noJump: false }, [47, -1], [-1, -1]);
assert.strictEqual(L.evalMove(g, 'red', 0, 4).to, 51, 'gate rule off: classic behaviour');
// the gate tile is the white tile touching the lane for every colour
L.COLORS.forEach(c => {
  const [x, y] = L.TRACK_XY[L.trackIdx(c, L.LAST_TRACK)], [lx, ly] = L.LANE_XY[c][0];
  assert.strictEqual(Math.abs(x - lx) + Math.abs(y - ly), 1, c + ' gate tile touches its lane');
});

// ---- full games never deadlock with both rules on, whatever else is toggled
let done = 0, N = 400;
for (let t = 0; t < N; t++) {
  const colors = L.COLORS.filter(() => Math.random() < .75); while (colors.length < 2) colors.push(L.COLORS[colors.length]);
  let gg = L.newGame({ board: L.BOARD_IDS[t % 2], noJump: true, homeGate: true, pawns: 1 + t % 4, blockade: t % 2 === 0, capture: t % 3 !== 0, safeTiles: t % 5 !== 0,
    exactFinish: t % 7 !== 0, needSix: t % 4 !== 1, finishMode: t % 6 === 0 ? 'ranking' : 'first' }, [...new Set(colors)]);
  let n = 0;
  while (gg.phase !== 'over' && n++ < 120000) {
    gg = L.roll(gg, 1 + Math.floor(Math.random() * 6));
    if (gg.phase === 'penalty') gg = L.losePawn(gg, L.botLose(gg, gg.turn));
    if (gg.phase === 'move') gg = L.move(gg, L.botChoose(gg, gg.turn));
    gg.order.forEach(c => gg.pawns[c].forEach(p => assert.ok(p >= -1 && p <= L.boardOf(gg).FINISH)));
  }
  if (gg.phase === 'over') done++; else console.log('STUCK', JSON.stringify(gg.settings), JSON.stringify(gg.pawns), gg.turn);
}
console.log('full games with noJump+homeGate:', done, '/', N);
assert.strictEqual(done, N);
console.log('NOJUMP + HOMEGATE TESTS PASSED');
