// Net-level seat logic, run in "local" mode (no Firebase): bot levels, replay recording, claiming an abandoned seat.
global.t = k => k; global.Ludo = require('../js/ludo-engine.js'); global.localStorage = { getItem() { return null; }, setItem() {} };
const assert = require('assert'); const D = require('../js/dice.js');
const src = require('fs').readFileSync(__dirname + '/../js/ludo-net.js', 'utf8') + ';module.exports=Net;';
const m = { exports: {} }; new Function('module', 'require', src)(m, require); const Net = m.exports, L = Ludo;

(async () => {
  // bot seats: nameless (named per palette in the UI), level default normal, settable, validated
  Net.createLocal('A'); await Net.addSeat('green', 'bot');
  assert.strictEqual(Net.S.room.seats.green.name, ''); assert.strictEqual(Net.botLevel(Net.S.room.seats.green), 'normal');
  assert.ok(await Net.setBotLevel('green', 'hard')); assert.strictEqual(Net.botLevel(Net.S.room.seats.green), 'hard');
  assert.ok(!(await Net.setBotLevel('green', 'godlike'))); assert.ok(!(await Net.setBotLevel('red', 'easy')), 'only bots have levels');
  assert.strictEqual(Net.botLevel({ bot: true, level: 'nope' }), 'normal');

  // a played game is recorded and replays to the same final position
  await Net.startGame(); assert.strictEqual(Net.S.room.replay.ev, '>');
  for (let n = 0; Net.S.room.status === 'playing' && n < 8000; n++) {
    const g = Net.S.room.g;
    if (g.phase === 'roll') await Net.doRoll(g.v, D.roll()); else await Net.doMove(g.v, L.botChoose(g, g.turn, Net.botLevel(Net.S.room.seats[g.turn])));
  }
  const r = Net.S.room, rs = L.replayStates(r.replay), last = rs.states[rs.states.length - 1];
  assert.strictEqual(r.status, 'ended'); assert.deepStrictEqual(last.pawns, r.g.pawns); assert.strictEqual(last.winner, r.g.winner);
  assert.ok(!(await Net.doRoll(r.g.v, 3)), 'no roll after the game is over');
  const evLen = r.replay.ev.length; await Net.backToLobby(); assert.strictEqual(Net.S.room.replay.ev.length, evLen, 'replay survives the trip back to the lobby');

  // claiming an abandoned seat
  const base = () => ({ status: 'playing', hostUid: 'u_old', settings: L.normalizeSettings({}), seats: {
    red: { uid: 'u_old', name: 'Old', connected: false, lastSeen: Date.now() - 60000, bot: false },
    yellow: { uid: 'bot_yellow', name: '', bot: true, connected: true }, green: { uid: 'u_other', name: 'Pal', connected: true, bot: false } }, g: null });
  const put = room => { Net.S.mode = 'local'; Net.S.room = room; };
  put(base()); assert.deepStrictEqual(Net.claimableSeats(Net.S.room), ['red']);
  assert.ok(await Net.claimSeat('red', 'Me'));
  let s = Net.S.room.seats.red; assert.strictEqual(s.uid, Net.MY_UID); assert.strictEqual(s.connected, true); assert.strictEqual(s.name, 'Me');
  assert.strictEqual(Net.S.room.hostUid, Net.MY_UID, 'host role follows the seat');
  put(base()); assert.ok(!(await Net.claimSeat('yellow')), 'bots cannot be claimed'); assert.ok(!(await Net.claimSeat('green')), 'connected players cannot be claimed');
  put(Object.assign(base(), { status: 'lobby' })); assert.ok(!(await Net.claimSeat('red')), 'lobby seats are not claimable');
  const mine = base(); mine.seats.green.uid = Net.MY_UID; put(mine); assert.ok(!(await Net.claimSeat('red')), 'already seated');
  const fresh = base(); fresh.seats.red.lastSeen = Date.now(); put(fresh); assert.deepStrictEqual(Net.claimableSeats(Net.S.room), [], 'a seat just dropped (reload?) is not offered yet');
  console.log('NET SEAT TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
