// ludo-net.js — room storage + all room-level actions.
// Two backends behind one interface:
//   online : Firebase Realtime Database, room at rooms/ludo_<CODE>
//   local  : in-memory (offline / hot-seat / vs bots), no network at all
//
// Every write is a pure function  room -> room  (or undefined to abort). Online it runs
// inside a Firebase transaction (so racing clients can't clobber each other), locally it
// just runs. Game rules themselves live in ludo-engine.js.

const Net = (function () {
  const L = Ludo;
  const MY_UID = (function () {
    try {
      let id = localStorage.getItem('ludo_uid');
      if (!id) { id = 'u_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('ludo_uid', id); }
      return id;
    } catch (e) { return 'u_' + Math.random().toString(36).slice(2, 10); }
  })();

  const ONLINE_OK = typeof db !== 'undefined' && db !== null;
  const AFK_MS = 20000;

  const S = {
    mode: null,        // 'online' | 'local'
    code: null,
    room: null,        // normalized mirror of the room
    onChange: null,    // callback(room, prevRoom)
    ref: null,
    connRef: null
  };

  function codeGen() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  const keyOf = code => 'ludo_' + code;

  function normalizeRoom(r) {
    if (!r) return r;
    r.seats = r.seats || {};
    r.settings = L.normalizeSettings(r.settings);
    if (r.replay) { r.replay.colors = Array.isArray(r.replay.colors) ? r.replay.colors : Object.values(r.replay.colors || {}); r.replay.ev = String(r.replay.ev || '>'); }
    if (r.g) {
      L.normalize(r.g);
      if (r.g.lastMove) r.g.lastMove.captured = r.g.lastMove.captured ? Object.values(r.g.lastMove.captured) : [];
      if (r.g.lastMove && r.g.lastMove.path) r.g.lastMove.path = Object.values(r.g.lastMove.path);
      if (r.g.prevMove && r.g.prevMove.path) r.g.prevMove.path = Object.values(r.g.prevMove.path);
    }
    return r;
  }

  function emit(prev) { cacheRoom(); if (S.onChange) S.onChange(S.room, prev); }

  // ---- reload without a flash: the last room I was seated in is kept in localStorage, so a reload can
  // draw the board at once (from that snapshot) while Firebase delivers the live state a moment later.
  const SNAP_KEY = 'ludo_snap', SNAP_MAX_AGE = 6 * 36e5;
  function cacheRoom() {
    try {
      if (S.mode === 'online' && S.room && S.code && mySeatColor(S.room)) localStorage.setItem(SNAP_KEY, JSON.stringify({ code: S.code, uid: MY_UID, ts: Date.now(), room: S.room }));
    } catch (e) {}
  }
  function clearCache() { try { localStorage.removeItem(SNAP_KEY); } catch (e) {} }
  // true = the room was drawn from the snapshot and is now attached (live updates follow)
  function preload(code) {
    if (!ONLINE_OK || !code) return false;
    try {
      const c = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null');
      if (!c || c.code !== String(code).toUpperCase() || c.uid !== MY_UID || Date.now() - (c.ts || 0) > SNAP_MAX_AGE || !c.room) return false;
      const room = normalizeRoom(c.room);
      if (!mySeatColor(room)) return false;
      attach(c.code);                      // sets mode/code and starts listening (the live snapshot comes later)
      S.room = room; emit(null);
      return true;
    } catch (e) { return false; }
  }

  // ---- generic mutate ---------------------------------------------------------
  async function mutate(fn) {
    if (S.mode === 'local') {
      const prev = S.room;
      const next = fn(JSON.parse(JSON.stringify(S.room)));
      if (!next) return false;
      S.room = normalizeRoom(next);
      emit(prev);
      return true;
    }
    if (S.mode === 'online') {
      const res = await S.ref.transaction(cur => {
        if (cur === null) return cur;
        const c = normalizeRoom(JSON.parse(JSON.stringify(cur)));
        const out = fn(c);
        return out === undefined || out === false ? undefined : out;
      }, undefined, false);
      return !!(res && res.committed);
    }
    return false;
  }

  // ---- connect / disconnect -----------------------------------------------------
  function attach(code) {
    S.mode = 'online'; S.code = code;
    S.ref = db.ref('rooms/' + keyOf(code));
    S.ref.on('value', snap => {
      const prev = S.room;
      const val = snap.val();
      if (!val) { S.room = null; emit(prev); return; }
      S.room = normalizeRoom(val);
      emit(prev);
    });
    // presence: flag my seat as connected, and clear it automatically on disconnect
    S.connRef = db.ref('.info/connected');
    S.connRef.on('value', snap => {
      if (snap.val() !== true || !S.room) return;
      armPresence();
    });
  }
  function mySeatColor(room) {
    room = room || S.room; if (!room) return null;
    return Object.keys(room.seats).find(c => room.seats[c] && room.seats[c].uid === MY_UID) || null;
  }
  function armPresence() {
    const c = mySeatColor(); if (!c || S.mode !== 'online') return;
    const r = S.ref.child('seats/' + c);
    r.child('connected').onDisconnect().set(false);
    r.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
    r.child('connected').set(true);
    r.child('lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
  }
  function detach() {
    if (S.ref) { S.ref.off(); S.ref = null; }
    if (S.connRef) { S.connRef.off(); S.connRef = null; }
    S.mode = null; S.code = null; S.room = null; clearCache();
  }

  // ---- lobby actions ------------------------------------------------------------
  function freeColor(room, prefer) {
    const order = Object.keys(room.seats).length === 0 ? ['red', 'yellow', 'green', 'blue']
                                                       : ['yellow', 'green', 'blue', 'red'];
    if (prefer && !room.seats[prefer]) return prefer;
    return order.find(c => !room.seats[c]) || null;
  }
  const baseRoom = (host) => ({
    game: 'ludo', hostUid: host, status: 'lobby', settings: Object.assign({}, L.DEFAULT_SETTINGS),
    seats: {}, g: null, createdAt: Date.now()
  });

  async function createOnline(name) {
    if (!ONLINE_OK) throw new Error('offline');
    const code = codeGen();
    const room = baseRoom(MY_UID);
    room.seats.red = { uid: MY_UID, name, connected: true, bot: false };
    await db.ref('rooms/' + keyOf(code)).set(room);
    attach(code);
    return code;
  }

  async function joinOnline(code, name) {
    if (!ONLINE_OK) throw new Error('offline');
    code = code.toUpperCase().trim();
    const snap = await db.ref('rooms/' + keyOf(code)).get();
    if (!snap.exists()) return { ok: false, reason: 'noRoom' };
    attach(code);
    // wait for first snapshot to land so we can decide
    await new Promise(res => { const t0 = Date.now(); (function w() { if (S.room || Date.now() - t0 > 4000) res(); else setTimeout(w, 30); })(); });
    if (!S.room) { detach(); return { ok: false, reason: 'noRoom' }; }
    if (mySeatColor()) { return { ok: true, resumed: true }; }
    if (S.room.status === 'lobby') {
      const ok = await mutate(r => {
        if (r.status !== 'lobby') return undefined;
        if (Object.values(r.seats).some(s => s && s.uid === MY_UID)) return r;
        const c = freeColor(r);
        if (!c) return undefined;
        r.seats[c] = { uid: MY_UID, name, connected: true, bot: false };
        return r;
      });
      if (!ok) { detach(); return { ok: false, reason: 'roomFull' }; }
      return { ok: true };
    }
    return { ok: true, spectator: true };
  }

  async function tryRejoin(code) {
    if (!ONLINE_OK || !code) return null;
    const snap = await db.ref('rooms/' + keyOf(code.toUpperCase())).get();
    if (!snap.exists()) return null;
    const r = normalizeRoom(snap.val());
    if (Object.values(r.seats).some(s => s && s.uid === MY_UID)) { attach(code.toUpperCase()); return code.toUpperCase(); }
    return null;
  }

  // Read-only look at a room (no attach): is it there, what is it doing, do I still hold a seat?
  async function peek(code) {
    if (!ONLINE_OK || !code) return null;
    try {
      const snap = await db.ref('rooms/' + keyOf(code.toUpperCase())).get();
      if (!snap.exists()) return null;
      const r = normalizeRoom(snap.val()), color = mySeatColor(r);
      return { code: code.toUpperCase(), status: r.status, color, claimable: claimableSeats(r) };
    } catch (e) { return null; }
  }
  // Human seats whose player has left mid-game: a new device / cleared storage can take one over.
  function claimableSeats(room, now) {
    now = now || Date.now();
    if (!room || room.status === 'lobby') return [];
    return Object.keys(room.seats).filter(c => { const s = room.seats[c]; return s && !s.bot && !s.local && s.connected === false && now - (s.lastSeen || 0) > 3000; });
  }
  function claimSeat(color, name) {
    return mutate(r => {
      const s = r.seats[color];
      if (r.status === 'lobby' || !s || s.bot || s.local || s.connected !== false) return undefined;
      if (Object.values(r.seats).some(x => x && x.uid === MY_UID)) return undefined;     // already seated
      if (r.hostUid === s.uid) r.hostUid = MY_UID;
      s.uid = MY_UID; s.connected = true; s.lastSeen = Date.now(); if (name) s.name = name.slice(0, 16);
      return r;
    }).then(ok => { if (ok) armPresence(); return ok; });
  }

  function createLocal(name) {
    S.mode = 'local'; S.code = 'LOCAL';
    const room = baseRoom('local_host');
    room.seats.red = { uid: 'local_1', name, local: true, bot: false, connected: true };
    room.seats.yellow = { uid: 'bot_1', name: '', bot: true, level: 'normal', connected: true };
    S.room = normalizeRoom(room);
    return 'LOCAL';
  }

  const isHost = (room) => S.mode === 'local' || (room && room.hostUid === MY_UID);

  function setSetting(key, value) {
    return mutate(r => { if (r.status !== 'lobby') return undefined; r.settings[key] = value; r.settings = L.normalizeSettings(r.settings); return r; });
  }
  // Relative change applied inside the transaction, so rapid +/- clicks never act on a stale value.
  function stepSetting(key, delta, min, max) {
    return mutate(r => {
      if (r.status !== 'lobby') return undefined;
      r.settings[key] = Math.max(min, Math.min(max, (parseInt(r.settings[key], 10) || 0) + delta));
      r.settings = L.normalizeSettings(r.settings); return r;
    });
  }
  function sit(color) {
    if (S.mode !== 'online') return;
    return mutate(r => {
      if (r.status !== 'lobby' || r.seats[color]) return undefined;
      const old = Object.keys(r.seats).find(c => r.seats[c] && r.seats[c].uid === MY_UID);
      if (!old) return undefined;
      r.seats[color] = r.seats[old]; delete r.seats[old];
      return r;
    }).then(ok => { if (ok) armPresence(); return ok; });
  }
  function addSeat(color, kind, name) {
    return mutate(r => {
      if (r.status !== 'lobby' || r.seats[color]) return undefined;
      const n = Object.values(r.seats).filter(x => x && !x.bot).length + 1;
      if (kind === 'bot') r.seats[color] = { uid: 'bot_' + color, name: '', bot: true, level: 'normal', connected: true };
      else r.seats[color] = { uid: 'local_' + color, name: name || (t('player') + ' ' + n), local: true, bot: false, connected: true };
      return r;
    });
  }
  function removeSeat(color) {
    return mutate(r => { if (r.status !== 'lobby' || !r.seats[color]) return undefined; delete r.seats[color]; return r; });
  }
  function setBotLevel(color, level) {
    return mutate(r => { const s = r.seats[color]; if (!s || !s.bot || L.BOT_LEVELS.indexOf(level) < 0) return undefined; s.level = level; return r; });
  }
  const botLevel = seat => (seat && L.BOT_LEVELS.indexOf(seat.level) >= 0) ? seat.level : 'normal';
  function renameSeat(color, name) {
    return mutate(r => { if (!r.seats[color]) return undefined; r.seats[color].name = name.slice(0, 16); return r; });
  }
  function leaveSeat() {
    // online: free my seat in the lobby; during a game the seat is kept (bot plays for me)
    if (S.mode !== 'online') return Promise.resolve();
    const c = mySeatColor(); if (!c) return Promise.resolve();
    return mutate(r => {
      if (r.status === 'lobby') {
        delete r.seats[c];
        const rest = Object.keys(r.seats).filter(k => r.seats[k] && !r.seats[k].bot);
        if (r.hostUid === MY_UID && rest.length) r.hostUid = r.seats[rest[0]].uid;
        return r;
      }
      r.seats[c].connected = false; r.seats[c].lastSeen = Date.now(); return r;
    });
  }

  function startGame() {
    return mutate(r => {
      if (r.status !== 'lobby') return undefined;
      const colors = Object.keys(r.seats).filter(c => r.seats[c]);
      if (colors.length < 2) return undefined;
      r.g = L.newGame(r.settings, colors, colors[Math.floor(Math.random() * colors.length)]);
      // everything needed to replay this game later: its start + every roll ('1'-'6') and move ('a'-'d')
      r.replay = { settings: JSON.parse(JSON.stringify(r.settings)), colors: L.COLORS.filter(c => colors.indexOf(c) >= 0), first: r.g.turn, ev: '>' };
      r.status = 'playing';
      return r;
    });
  }
  function backToLobby() {
    return mutate(r => { r.status = 'lobby'; r.g = null; return r; });
  }

  // ---- in-game actions ----------------------------------------------------------
  // `expect` = {v} protects against acting on stale state (double clicks, races).
  function doRoll(expectV, value) {
    return mutate(r => {
      if (r.status !== 'playing' || !r.g || r.g.v !== expectV || r.g.phase !== 'roll') return undefined;
      r.g = L.roll(r.g, value); r.g.v++;
      if (r.replay) r.replay.ev += value;
      if (r.g.phase === 'over') r.status = 'ended';
      return r;
    });
  }
  function doMove(expectV, pawn) {
    return mutate(r => {
      if (r.status !== 'playing' || !r.g || r.g.v !== expectV || r.g.phase !== 'move') return undefined;
      const next = L.move(r.g, pawn);
      if (next === r.g) return undefined;
      r.g = next; r.g.v++;
      if (r.replay) r.replay.ev += 'abcd'[pawn];
      if (r.g.phase === 'over') r.status = 'ended';
      return r;
    });
  }

  // House rule (6s in a row): the player picks which pawn to give up.
  function doLose(expectV, pawn) {
    return mutate(r => {
      if (r.status !== 'playing' || !r.g || r.g.v !== expectV || r.g.phase !== 'penalty') return undefined;
      const next = L.losePawn(r.g, pawn);
      if (next === r.g) return undefined;
      r.g = next; r.g.v++;
      if (r.replay) r.replay.ev += 'abcd'[pawn];
      return r;
    });
  }

  // Who may act for seat `color` on THIS client?
  function canActFor(room, color) {
    const seat = room && room.seats[color]; if (!seat) return false;
    if (S.mode === 'local') return !seat.bot;
    return seat.uid === MY_UID;
  }
  // Who drives bots / absent players? Host, or the first connected human if the host is gone.
  function isDriver(room) {
    if (S.mode === 'local') return true;
    const humans = Object.keys(room.seats).map(c => room.seats[c]).filter(s => s && !s.bot);
    const hostSeat = humans.find(s => s.uid === room.hostUid);
    if (hostSeat && hostSeat.connected) return room.hostUid === MY_UID;
    const first = humans.find(s => s.connected);
    return !!first && first.uid === MY_UID;
  }
  const seatIsAutoplayed = (seat, now) => !!seat && (seat.bot || (!seat.local && seat.connected === false && now - (seat.lastSeen || 0) > AFK_MS));

  return {
    MY_UID, ONLINE_OK, S, AFK_MS,
    mutate, createOnline, joinOnline, tryRejoin, createLocal, detach, mySeatColor, isHost,
    setSetting, stepSetting, sit, addSeat, removeSeat, renameSeat, setBotLevel, botLevel, leaveSeat, startGame, backToLobby,
    peek, claimableSeats, claimSeat, preload,
    doRoll, doMove, doLose, canActFor, isDriver, seatIsAutoplayed, freeColor
  };
})();
