// Cờ cá ngựa board (default): geometry + start-on-first-tile + lane/finish progress.
const L = require('../js/ludo-engine.js');
const assert = require('assert');
const H = L.BOARDS.horse;

assert.strictEqual(L.DEFAULT_BOARD, 'horse', 'cá ngựa is the default board');
assert.strictEqual(L.normalizeSettings({}).board, 'horse');
assert.strictEqual(L.normalizeSettings({ board: 'nope' }).board, 'horse');
assert.strictEqual(L.normalizeSettings({ board: 'classic' }).board, 'classic');

// --- geometry: 56 unique, orthogonally connected tiles, 14 per colour
assert.strictEqual(H.TRACK_XY.length, 56);
assert.strictEqual(new Set(H.TRACK_XY.map(p => p.join(','))).size, 56, 'unique');
for (let i = 0; i < 56; i++) {
  const a = H.TRACK_XY[i], b = H.TRACK_XY[(i + 1) % 56];
  assert.strictEqual(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1, 'orthogonal step ' + i);
}
// the loop runs through the four corner tiles of the cross
[[6, 6], [8, 6], [8, 8], [6, 8]].forEach(c => assert.ok(H.TRACK_XY.some(p => p[0] === c[0] && p[1] === c[1]), 'corner ' + c));
// every cell of the cross is used exactly once (track + lanes + centre)
const used = new Set(H.TRACK_XY.map(p => p.join(',')));
L.COLORS.forEach(c => H.LANE_XY[c].forEach(p => { assert.ok(!used.has(p.join(','))); used.add(p.join(',')); }));
used.add('7,7');
let cross = 0; for (let x = 0; x < 15; x++) for (let y = 0; y < 15; y++) if ((x >= 6 && x <= 8) || (y >= 6 && y <= 8)) cross++;
assert.strictEqual(used.size, cross, 'the cross is fully covered');

// --- start tile = FIRST tile of the arm, arrow side matches the picture
assert.deepStrictEqual(H.TRACK_XY[H.START.red], [0, 6]);
assert.deepStrictEqual(H.TRACK_XY[H.START.green], [8, 0]);
assert.deepStrictEqual(H.TRACK_XY[H.START.yellow], [14, 8]);
assert.deepStrictEqual(H.TRACK_XY[H.START.blue], [6, 14]);

// --- last track tile touches lane tile 1; lane is a straight line ending next to the centre
assert.strictEqual(H.LANE_LEN, 6);
L.COLORS.forEach(c => {
  const last = H.TRACK_XY[L.trackIdx(c, H.LAST_TRACK, H)], lane = H.LANE_XY[c];
  const d = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  assert.strictEqual(d(last, lane[0]), 1, c + ' track -> lane');
  for (let i = 0; i < 5; i++) assert.strictEqual(d(lane[i], lane[i + 1]), 1);
  assert.strictEqual(d(lane[5], [7, 7]), 1, c + ' lane -> centre');
});
// a full lap covers 56 tiles and ends on the tile just before its own start
L.COLORS.forEach(c => assert.strictEqual(L.trackIdx(c, H.LAST_TRACK, H), (H.START[c] + 55) % 56));

// --- rules on this board
const mk = o => L.newGame(Object.assign({ board: 'horse', noJump: false, homeGate: false, needSix: true }, o), ['red', 'yellow'], 'red');
let g = mk({});
g = L.roll(g, 6); assert.strictEqual(g.phase, 'move');
g = L.move(g, 0); assert.strictEqual(g.pawns.red[0], 0, 'pawn leaves base to progress 0 = first tile');
assert.deepStrictEqual(H.TRACK_XY[L.trackIdx('red', g.pawns.red[0], H)], [0, 6]);

// exact finish: lane is 6 long, finish = 62
let a = mk({}); a.pawns.red = [60, -1, -1, -1];
assert.strictEqual(L.evalMove(a, 'red', 0, 3), null);
assert.ok(L.evalMove(a, 'red', 0, 2).finishes);
// bounce back when exactFinish is off: 60 + 4 = 64 -> 62 - 2 = 60 (no move), +3 = 63 -> 61
a.settings.exactFinish = false; assert.strictEqual(L.evalMove(a, 'red', 0, 4), null); assert.strictEqual(L.evalMove(a, 'red', 0, 3).to, 61);

// home gate: must land exactly on progress 55 first
a = mk({ homeGate: true }); a.pawns.red = [52, -1, -1, -1];
assert.strictEqual(L.evalMove(a, 'red', 0, 4), null, 'cannot run straight into the lane');
assert.strictEqual(L.evalMove(a, 'red', 0, 3).to, 55);
a.pawns.red = [55, -1, -1, -1]; assert.strictEqual(L.evalMove(a, 'red', 0, 1).to, 56, 'gate -> lane tile 1');

// capture + safe tiles use the 56-tile loop
a = mk({}); a.pawns.red = [5, -1, -1, -1]; a.pawns.yellow = [-1, -1, -1, -1];
a.pawns.yellow[0] = (6 - 28 + 56) % 56;              // yellow progress that lands on red's p6 tile (track idx 6)
assert.strictEqual(L.trackIdx('yellow', a.pawns.yellow[0], H), 6);
a.phase = 'move'; a.die = 1; a.turn = 'red';
let r = L.move(a, 0); assert.strictEqual(r.pawns.yellow[0], -1, 'captured'); assert.strictEqual(r.pawns.red[0], 6);
// star tile = start + 8
assert.ok(H.SAFE.has(8) && H.SAFE.has(22) && H.SAFE.has(36) && H.SAFE.has(50) && H.SAFE.has(0) && H.SAFE.has(14));
a.pawns.yellow[0] = (8 - 28 + 56) % 56; a.pawns.red = [7, -1, -1, -1];
r = L.move(a, 0); assert.strictEqual(r.pawns.yellow[0], a.pawns.yellow[0], 'safe star: enemy stays');

// old saved games without settings.board keep classic geometry
const old = L.clone(mk({})); delete old.settings.board;
assert.strictEqual(L.boardOf(old).id, 'classic');

// start tile: safe for its owner only. Yellow stands on red's start tile (0,6); red leaves base and kicks it.
a = mk({ safeTiles: true, noJump: true }); a.pawns.red = [-1, -1, -1, -1]; a.pawns.yellow = [(0 - 28 + 56) % 56, -1, -1, -1];
a.phase = 'move'; a.die = 6; a.turn = 'red';
r = L.move(a, 0); assert.strictEqual(r.pawns.red[0], 0); assert.strictEqual(r.pawns.yellow[0], -1, 'enemy on my start tile is kicked');
// ...while red's own pawn on its start tile can't be kicked by yellow
a = mk({ safeTiles: true, noJump: false }); a.pawns.red = [0, -1, -1, -1]; a.pawns.yellow = [(0 - 28 + 56 - 3 + 56) % 56, -1, -1, -1];
a.phase = 'move'; a.die = 3; a.turn = 'yellow';
r = L.move(a, 0); assert.strictEqual(r.pawns.red[0], 0, 'owner on own start tile is safe');

console.log('HORSE BOARD TESTS PASSED');
