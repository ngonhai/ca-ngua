// ludo-engine.js — pure Ludo rules. No DOM, no Firebase: every function takes a
// game object and returns a NEW one (or a list), so it can be unit-tested in Node
// and re-used by both online (Firebase) and offline (local) modes.
//
// Two boards share the same rules (settings.board picks one):
//   'horse'   Cờ cá ngựa (DEFAULT) — 56-tile loop that also runs through the 4 corner tiles,
//             pawns come out on the FIRST tile of their arm, 6-tile home lane numbered 1..6.
//   'classic' Standard Ludo — 52-tile loop, start on the 2nd tile of the arm, 5-tile home lane.
//
// Coordinates / progress model (per board, see BOARDS)
//   Each pawn has a "progress" number relative to its own colour:
//     -1                        in base (yard)
//     0 .. LAST_TRACK           on the shared track (0 = that colour's start tile)
//     LAST_TRACK+1 .. FINISH-1  in its private home lane
//     FINISH                    finished (centre)
// Phases: 'roll' -> 'move' (pick a pawn) -> next turn, plus 'penalty' (house rule: pick a pawn to lose) and 'over'.
//   Track index of a pawn = (START[color] + progress) % TRACK.

(function (root) {
  'use strict';

  const COLORS = ['red', 'green', 'yellow', 'blue'];      // clockwise seat order

  // ---- classic board: 15x15 grid, 52 track tiles, clockwise, [col,row] ----------------------
  const CLASSIC_TRACK_XY = (function () {
    const L = [];
    for (let c = 0; c <= 5; c++) L.push([c, 6]);
    for (let r = 5; r >= 0; r--) L.push([6, r]);
    L.push([7, 0]);
    for (let r = 0; r <= 5; r++) L.push([8, r]);
    for (let c = 9; c <= 14; c++) L.push([c, 6]);
    L.push([14, 7]);
    for (let c = 14; c >= 9; c--) L.push([c, 8]);
    for (let r = 9; r <= 14; r++) L.push([8, r]);
    L.push([7, 14]);
    for (let r = 14; r >= 9; r--) L.push([6, r]);
    for (let c = 5; c >= 0; c--) L.push([c, 8]);
    L.push([0, 7]);
    return L;
  })();

  // ---- cá ngựa board: 15x15 grid, 56 track tiles, clockwise ---------------------------------
  // Every arm is 3 tiles wide and the loop goes THROUGH the corner tiles (6,6) (8,6) (8,8) (6,8).
  // 14 tiles per colour: the start tile is the first tile of its arm.
  const HORSE_TRACK_XY = (function () {
    const L = [];
    for (let c = 0; c <= 6; c++) L.push([c, 6]);      // red start (0,6) -> corner (6,6)
    for (let r = 5; r >= 0; r--) L.push([6, r]);
    L.push([7, 0]);
    for (let r = 0; r <= 6; r++) L.push([8, r]);      // green start (8,0) -> corner (8,6)
    for (let c = 9; c <= 14; c++) L.push([c, 6]);
    L.push([14, 7]);
    for (let c = 14; c >= 8; c--) L.push([c, 8]);     // yellow start (14,8) -> corner (8,8)
    for (let r = 9; r <= 14; r++) L.push([8, r]);
    L.push([7, 14]);
    for (let r = 14; r >= 8; r--) L.push([6, r]);     // blue start (6,14) -> corner (6,8)
    for (let c = 5; c >= 0; c--) L.push([c, 8]);
    L.push([0, 7]);
    return L;
  })();

  function makeBoard(id, o) {
    const SAFE = new Set(), STARS = new Set();     // SAFE = start tiles + stars (for drawing); STARS = safe for everybody
    COLORS.forEach(c => { SAFE.add(o.START[c]); SAFE.add((o.START[c] + 8) % o.TRACK); STARS.add((o.START[c] + 8) % o.TRACK); });
    return Object.assign({ id, SAFE, STARS, LANE_LEN: o.FINISH - o.LAST_TRACK - 1 }, o);
  }

  const BOARDS = {
    horse: makeBoard('horse', {
      TRACK: 56, LAST_TRACK: 55, FINISH: 62,
      START: { red: 0, green: 14, yellow: 28, blue: 42 },
      TRACK_XY: HORSE_TRACK_XY,
      LANE_XY: {
        red:    [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
        green:  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
        yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
        blue:   [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]]
      },
      CENTER: { x: 7, y: 7, w: 1, h: 1 }
    }),
    classic: makeBoard('classic', {
      TRACK: 52, LAST_TRACK: 50, FINISH: 56,
      START: { red: 1, green: 14, yellow: 27, blue: 40 },
      TRACK_XY: CLASSIC_TRACK_XY,
      LANE_XY: {
        red:    [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        green:  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
        yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
        blue:   [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]
      },
      CENTER: { x: 6, y: 6, w: 3, h: 3 }
    })
  };
  // Colour palettes. Seat keys (red/green/yellow/blue) never change — only how they are painted.
  // 'picture' follows the reference board: cyan (top-left), yellow, lime green, red-orange.
  const PALETTES = {
    classic: { hex: { red: '#ef4444', green: '#22c55e', yellow: '#facc15', blue: '#3b82f6' },
               dark: { red: '#b91c1c', green: '#15803d', yellow: '#ca8a04', blue: '#1d4ed8' } },
    picture: { hex: { red: '#2cc4cf', green: '#ffc400', yellow: '#8fc800', blue: '#ff3d17' },
               dark: { red: '#13959f', green: '#c79600', yellow: '#5f8c00', blue: '#c42a0c' } }
  };
  const PALETTE_IDS = ['classic', 'picture'], DEFAULT_PALETTE = 'classic';
  const BOT_LEVELS = ['easy', 'normal', 'hard'];
  const BOARD_IDS = ['horse', 'classic'];
  const DEFAULT_BOARD = 'horse';

  // The board a game/settings object is played on. Games saved before boards existed have no
  // `board` key and were Standard Ludo, so they keep that geometry.
  // Safe tiles: a ★ protects any pawn; a start tile protects only its OWNER's pawns
  // (an enemy standing on your start tile gets kicked when you leave base).
  const safeFor = (B, owner, idx) => B.STARS.has(idx) || B.START[owner] === idx;
  const boardOf = g => BOARDS[g && g.settings && g.settings.board] || BOARDS.classic;

  // Classic values stay exported under their old names (tests / old code).
  const { START, TRACK, LAST_TRACK, FINISH, SAFE, TRACK_XY, LANE_XY } = BOARDS.classic;

  // Host-editable rules. `type` drives the lobby UI; labels live in the UI i18n.
  const DEFAULT_SETTINGS = {
    board: DEFAULT_BOARD,   // 'horse' (cờ cá ngựa, default) | 'classic' (standard Ludo)
    palette: DEFAULT_PALETTE, // 'classic' | 'picture' — colours only, no effect on rules
    capture: true,          // landing on an opponent sends it back to base
    safeTiles: false,        // start tiles + stars can't be captured on
    needSix: true,          // need a 6 to leave base
    triesWhenStuck: true,   // 3 rolls when no pawn is on the board
    sixExtra: true,         // rolling a 6 gives another roll
    sixPenalty: true,       // HOUSE RULE: 3rd/6th six in a row = roll again, every other six from the 4th on = lose a pawn (see roll())
    maxSixes: 3,            // N sixes in a row cancels the move (0 = unlimited) — replaced by sixPenalty while that is on
    captureExtra: false,     // capturing gives another roll
    homeExtra: false,        // finishing a pawn gives another roll
    exactFinish: true,      // need exact roll to finish (off = bounce back)
    blockade: false,        // 2+ same-colour pawns on a tile can't be passed
    noJump: true,           // PARENT RULE: no jumping over pawns and no sharing a tile unless the landing kicks the pawn there
    homeGate: true,         // must land exactly on the last white tile before the home lane, then step into it
    autoMove: true,         // auto-play when only one move is possible
    pawns: 4,               // pawns per player (1-4)
    finishMode: 'ranking'     // 'first' = first finisher wins, 'ranking' = play for places
  };
  // `overriddenBy`: this rule has no effect while the named (parent) rule is on.
  const SETTINGS_META = [
    { key: 'board', type: 'board', options: BOARD_IDS },
    { key: 'palette', type: 'palette', options: PALETTE_IDS },
    { key: 'noJump', type: 'bool' },
    { key: 'capture', type: 'bool' },
    { key: 'safeTiles', type: 'bool', dependsOn: 'capture' },
    { key: 'captureExtra', type: 'bool', dependsOn: 'capture' },
    { key: 'blockade', type: 'bool', overriddenBy: 'noJump' },
    { key: 'needSix', type: 'bool' },
    { key: 'triesWhenStuck', type: 'bool', dependsOn: 'needSix' },
    { key: 'sixExtra', type: 'bool' },
    { key: 'sixPenalty', type: 'bool', dependsOn: 'sixExtra' },
    { key: 'maxSixes', type: 'num', min: 0, max: 6, step: 1, overriddenBy: 'sixPenalty' },
    { key: 'homeGate', type: 'bool' },
    { key: 'exactFinish', type: 'bool' },
    { key: 'homeExtra', type: 'bool' },
    { key: 'pawns', type: 'num', min: 1, max: 4, step: 1 },
    { key: 'finishMode', type: 'choice', options: ['first', 'ranking'] },
    { key: 'autoMove', type: 'bool' }
  ];

  const clone = o => JSON.parse(JSON.stringify(o));
  const trackIdx = (color, p, B) => { B = B || BOARDS.classic; return (p >= 0 && p <= B.LAST_TRACK) ? (B.START[color] + p) % B.TRACK : null; };

  function normalizeSettings(s) {
    const out = Object.assign({}, DEFAULT_SETTINGS, s || {});
    out.pawns = Math.max(1, Math.min(4, parseInt(out.pawns, 10) || 4));
    out.maxSixes = Math.max(0, Math.min(6, parseInt(out.maxSixes, 10) || 0));
    if (out.finishMode !== 'ranking') out.finishMode = 'first';
    if (!BOARDS[out.board]) out.board = DEFAULT_BOARD;
    if (!PALETTES[out.palette]) out.palette = DEFAULT_PALETTE;
    return out;
  }

  // Firebase drops empty arrays and may turn arrays into objects; put things back.
  function normalize(g) {
    if (!g) return g;
    g.ranking = g.ranking ? Object.values(g.ranking) : [];
    g.log = g.log ? Object.values(g.log) : [];
    g.order = Object.values(g.order || []);
    Object.keys(g.pawns || {}).forEach(c => { g.pawns[c] = Object.values(g.pawns[c]); });
    return g;
  }

  function newGame(settings, colors, firstColor) {
    const s = normalizeSettings(settings);
    const order = COLORS.filter(c => colors.includes(c));
    const pawns = {};
    order.forEach(c => { pawns[c] = Array(s.pawns).fill(-1); });
    return {
      v: 0, settings: s, order, pawns,
      turn: order.includes(firstColor) ? firstColor : order[0],
      phase: 'roll', die: 0, tries: 3, sixes: 0, rollSeq: 0, moveSeq: 0, lossSeq: 0,
      lastRoll: null, lastMove: null, lastLoss: null, ranking: [], winner: null, log: []
    };
  }

  const isDone = (g, c) => g.pawns[c].every(p => p === boardOf(g).FINISH);
  const anyOnBoard = (g, c) => g.pawns[c].some(p => p >= 0 && p < boardOf(g).FINISH);

  function pawnsAt(g, idx, exceptColor) {
    const out = [], B = boardOf(g);
    g.order.forEach(c => {
      if (c === exceptColor) return;
      g.pawns[c].forEach((p, i) => { if (trackIdx(c, p, B) === idx) out.push({ color: c, pawn: i }); });
    });
    return out;
  }
  // Other pawns standing on the cell a pawn of `color` would occupy at progress q.
  // Track cells (q 0..50) are shared by everybody; home-lane cells (51..55) are private; 56 = finish, never blocks.
  function occupantsOf(g, color, q, selfPawn) {
    const out = [], B = boardOf(g);
    if (q >= B.FINISH) return out;
    if (q > B.LAST_TRACK) {
      g.pawns[color].forEach((p, j) => { if (j !== selfPawn && p === q) out.push({ color, pawn: j }); });
      return out;
    }
    const idx = trackIdx(color, q, B);
    g.order.forEach(c => g.pawns[c].forEach((p, j) => {
      if (c === color && j === selfPawn) return;
      if (trackIdx(c, p, B) === idx) out.push({ color: c, pawn: j });
    }));
    return out;
  }
  function isBlockade(g, idx, forColor) {
    if (!g.settings.blockade || g.settings.noJump) return false;   // noJump is the parent rule: it makes blockades redundant
    const B = boardOf(g);
    return g.order.some(c => c !== forColor &&
      g.pawns[c].filter(p => trackIdx(c, p, B) === idx).length >= 2);
  }

  // Evaluate moving pawn i of `color` by `die`. Returns null when illegal.
  function evalMove(g, color, i, die) {
    const s = g.settings, p = g.pawns[color][i], B = boardOf(g), FINISH = B.FINISH, LAST_TRACK = B.LAST_TRACK;
    if (p === FINISH) return null;
    let to; const path = [];
    if (p === -1) {
      if (s.needSix && die !== 6) return null;
      to = 0; path.push(0);
    } else {
      to = p + die;
      if (to > FINISH) {
        if (s.exactFinish) return null;
        to = FINISH - (to - FINISH);
        if (to === p) return null;
        for (let q = p + 1; q <= FINISH; q++) path.push(q);
        for (let q = FINISH - 1; q >= to; q--) path.push(q);
      } else {
        for (let q = p + 1; q <= to; q++) path.push(q);
      }
    }
    // Home gate: you can't run straight into the home lane — first land exactly on the last track tile.
    if (s.homeGate && p >= 0 && p < LAST_TRACK && to > LAST_TRACK) return null;

    for (let k = 0; k < path.length; k++) {
      const idx = trackIdx(color, path[k], B);
      if (idx !== null && isBlockade(g, idx, color)) return null;
      // noJump (parent rule): any pawn on a cell we would pass over blocks the move.
      if (s.noJump && k < path.length - 1 && occupantsOf(g, color, path[k], i).length) return null;
    }
    const captures = [];
    const destIdx = trackIdx(color, to, B);
    if (s.capture && destIdx !== null) {
      pawnsAt(g, destIdx, color).forEach(o => { if (!(s.safeTiles && safeFor(B, o.color, destIdx))) captures.push(o); });
    }
    // noJump (parent rule): a cell can't be shared. Landing on a pawn is only legal if it kicks it —
    // so it overrides blockades, "capture off" and safe tiles, which would otherwise let pawns stack.
    if (s.noJump) {
      const there = occupantsOf(g, color, to, i);
      if (there.some(o => !captures.some(c => c.color === o.color && c.pawn === o.pawn))) return null;
    }
    return { pawn: i, from: p, to, path, captures, finishes: to === FINISH, leaves: p === -1 };
  }

  function legalMoves(g, color, die) {
    const out = [];
    g.pawns[color].forEach((_, i) => { const m = evalMove(g, color, i, die); if (m) out.push(m); });
    return out;
  }

  function pushLog(g, entry) { g.log.push(entry); if (g.log.length > 40) g.log.shift(); }

  function nextColor(g, from) {
    const n = g.order.length;
    let k = g.order.indexOf(from);
    for (let step = 1; step <= n; step++) {
      const c = g.order[(k + step) % n];
      if (!isDone(g, c)) return c;
    }
    return from;
  }
  function passTurn(g) {
    g.turn = nextColor(g, g.turn);
    g.phase = 'roll'; g.sixes = 0; g.tries = 3;
  }

  // ---- six penalty (house rule) ---------------------------------------------------
  // Counting sixes in a row (g.sixes, reset by any other number or by the turn passing):
  //   3rd and 6th six   -> that roll is void, roll again ("xóc lại")
  //   4th, 5th, 7th, 8th (… every six that is not a multiple of 3, from the 4th) -> void AND lose one pawn
  //   (so 4 sixes = 1 pawn, 5 = 2, 7 = 3, 8 = 4), then roll again.
  // Pawns that can be lost: anything on the board (track or home lane) that has not finished.
  // Only one such pawn (or none) -> nothing to choose; several -> phase 'penalty' and the player picks.
  const penaltyPawns = (g, color) => {
    const F = boardOf(g).FINISH, out = [];
    g.pawns[color].forEach((p, i) => { if (p >= 0 && p < F) out.push(i); });
    return out;
  };
  function applyLoss(g, color, i) {
    const from = g.pawns[color][i];
    g.pawns[color][i] = -1;
    g.lossSeq = (g.lossSeq || 0) + 1;
    g.lastLoss = { seq: g.lossSeq, color, pawn: i, from };
    pushLog(g, { k: 'sixLose', c: color });
  }
  function rollAgain(g) { g.phase = 'roll'; g.tries = 3; }

  // Apply a dice value for the player whose turn it is. Returns a new game.
  function roll(game, value) {
    const g = clone(game);
    if (g.phase !== 'roll') return game;
    const color = g.turn, s = g.settings;
    g.die = value; g.rollSeq++;
    g.lastRoll = { seq: g.rollSeq, color, value };
    pushLog(g, { k: 'roll', c: color, d: value });
    if (value === 6) g.sixes++; else g.sixes = 0;
    if (value === 6 && s.sixExtra && s.sixPenalty && g.sixes >= 3) {
      const n = g.sixes;
      if (n % 3 === 0) { pushLog(g, { k: 'sixAgain', c: color, d: n }); rollAgain(g); return g; }
      const cand = penaltyPawns(g, color);
      if (!cand.length) { pushLog(g, { k: 'sixNone', c: color, d: n }); rollAgain(g); return g; }
      pushLog(g, { k: 'sixPen', c: color, d: n });
      // one pawn, or several on the very same progress (identical for the player): nothing to choose
      if (new Set(cand.map(i => g.pawns[color][i])).size === 1) { applyLoss(g, color, cand[0]); rollAgain(g); return g; }
      g.phase = 'penalty'; return g;
    }
    if (value === 6 && !s.sixPenalty && s.maxSixes && g.sixes >= s.maxSixes) {
      pushLog(g, { k: 'sixes', c: color });
      passTurn(g); return g;
    }
    const moves = legalMoves(g, color, value);
    if (!moves.length) {
      // a 6 always earns the extra roll, even when it cannot be played
      if (value === 6 && s.sixExtra) { pushLog(g, { k: 'sixStuck', c: color }); rollAgain(g); return g; }
      if (s.needSix && s.triesWhenStuck && !anyOnBoard(g, color) && g.tries > 1) {
        g.tries--; return g;                     // stays in 'roll' phase: try again
      }
      pushLog(g, { k: 'pass', c: color });
      passTurn(g); return g;
    }
    g.phase = 'move';
    return g;
  }

  // Penalty phase: the player gives up pawn `i`. Returns a new game (same object if illegal).
  function losePawn(game, i) {
    const g = clone(game);
    if (g.phase !== 'penalty' || penaltyPawns(g, g.turn).indexOf(i) < 0) return game;
    applyLoss(g, g.turn, i);
    rollAgain(g);
    return g;
  }
  // Bot: gives up the pawn with the least progress (ties: first).
  function botLose(g, color) {
    const c = penaltyPawns(g, color); if (!c.length) return null;
    return c.reduce((a, b) => (g.pawns[color][b] < g.pawns[color][a] ? b : a));
  }

  // Move pawn `i` using the pending die. Returns a new game.
  function move(game, i) {
    const g = clone(game);
    if (g.phase !== 'move') return game;
    const color = g.turn, s = g.settings;
    const m = evalMove(g, color, i, g.die);
    if (!m) return game;
    g.pawns[color][i] = m.to;
    m.captures.forEach(o => { g.pawns[o.color][o.pawn] = -1; });
    g.moveSeq++;
    // keep the move before this one (slim) so the UI can show the footprints of the last 2 moves, even after a reload
    g.prevMove = g.lastMove ? { seq: g.lastMove.seq, color: g.lastMove.color, pawn: g.lastMove.pawn, from: g.lastMove.from, to: g.lastMove.to, path: g.lastMove.path } : null;
    g.lastMove = { seq: g.moveSeq, color, pawn: i, from: m.from, to: m.to, path: m.path,
      captured: m.captures, die: g.die };
    if (m.leaves) pushLog(g, { k: 'leave', c: color });
    m.captures.forEach(o => pushLog(g, { k: 'capture', c: color, o: o.color }));
    if (m.finishes) pushLog(g, { k: 'home', c: color });

    let extra = (g.die === 6 && s.sixExtra) || (m.captures.length > 0 && s.captureExtra) ||
                (m.finishes && s.homeExtra);

    if (isDone(g, color)) {
      g.ranking.push(color);
      pushLog(g, { k: 'rank', c: color, d: g.ranking.length });
      extra = false;
      const left = g.order.filter(c => !isDone(g, c));
      if (s.finishMode === 'first' || left.length <= 1) {
        if (left.length === 1 && s.finishMode !== 'first') g.ranking.push(left[0]);
        g.winner = g.ranking[0]; g.phase = 'over'; return g;
      }
    }
    if (extra) {
      g.phase = 'roll'; g.tries = 3;
      pushLog(g, { k: 'extra', c: color });
    } else passTurn(g);
    return g;
  }

  // ---- Bot -------------------------------------------------------------------
  function danger(g, color, idx) {
    const B = boardOf(g);
    if (idx === null || (g.settings.safeTiles && safeFor(B, color, idx)) || !g.settings.capture) return 0;
    let n = 0;
    g.order.forEach(c => {
      if (c === color) return;
      g.pawns[c].forEach(p => {
        const j = trackIdx(c, p, B);
        if (j === null) return;
        const d = (idx - j + B.TRACK) % B.TRACK;
        if (d >= 1 && d <= 6) n++;
      });
    });
    return n;
  }
  // Hard bot look-ahead: after our move, for each dice value the next player could roll, how much
  // progress of ours could they take with their best capture? Averaged over the 6 values.
  // (If we keep the turn — extra roll — the danger is halved: we get to react first.)
  function replyRisk(g1, color) {
    if (!g1.settings.capture || g1.phase === 'over') return 0;
    const next = g1.turn; if (next === color) return 0;
    let total = 0;
    for (let d = 1; d <= 6; d++) {
      let worst = 0;
      legalMoves(g1, next, d).forEach(m => {
        let v = 0; m.captures.forEach(o => { if (o.color === color) v += Math.max(0, g1.pawns[color][o.pawn]) + 12; });
        if (v > worst) worst = v;
      });
      total += worst;
    }
    return total / 6;
  }

  // Chances we create: enemy pawns 1..6 tiles ahead of our pawns on the track (each is a 1-in-6 shot).
  function threatValue(g1, color) {
    const B = boardOf(g1); if (!g1.settings.capture) return 0;
    let v = 0;
    g1.pawns[color].forEach(p => {
      const i = trackIdx(color, p, B); if (i === null) return;
      g1.order.forEach(c => {
        if (c === color) return;
        g1.pawns[c].forEach(q => {
          const j = trackIdx(c, q, B); if (j === null) return;
          if (g1.settings.safeTiles && safeFor(B, c, j)) return;
          const d = (j - i + B.TRACK) % B.TRACK;
          if (d >= 1 && d <= 6) v += (q + 12) / 6;
        });
      });
    });
    return v;
  }
  const HARD = { prog: 0.4, noise: 0.8, cap: 60, capProg: 0.8, leave: 45, leaveFirst: 60, risk: 2.0, safe: 8, extra: 0.5, threat: 1.5 };
  const LEVEL_K = { easy: { noise: 24, cap: 0.5, dng: 0.15, leave: 0.6 }, normal: { noise: 9, cap: 1, dng: 0.8, leave: 1 } };   // hard-bot weights
  // level: 'easy' | 'normal' (default, the original scoring) | 'hard' (risk-aware)
  function botChoose(g, color, level) {
    const moves = legalMoves(g, color, g.die);
    if (!moves.length) return null;
    const B = boardOf(g), LAST_TRACK = B.LAST_TRACK;
    level = BOT_LEVELS.indexOf(level) >= 0 ? level : 'normal';
    if (level === 'easy' && Math.random() < 0.3) return moves[Math.floor(Math.random() * moves.length)].pawn;
    let best = null, bestScore = -1e9;
    moves.forEach(m => {
      let sc;
      const fromIdx = trackIdx(color, m.from, B), toIdx = trackIdx(color, m.to, B);
      if (level === 'hard') {
        const H = HARD;
        sc = m.to * H.prog + Math.random() * H.noise;
        if (m.finishes) sc += 100;
        m.captures.forEach(o => { sc += H.cap + Math.max(0, g.pawns[o.color][o.pawn]) * H.capProg; });
        if (m.leaves) sc += anyOnBoard(g, color) ? H.leave : H.leaveFirst;
        if (m.to > LAST_TRACK && m.from <= LAST_TRACK) sc += 30;
        if (g.settings.homeGate && m.to === LAST_TRACK) sc += 18;
        const g1 = move(g, m.pawn);
        sc -= replyRisk(g1, color) * H.risk * (g1.turn === color ? H.extra : 1);
        if (H.threat) sc += threatValue(g1, color) * H.threat;
        if (toIdx !== null && g.settings.safeTiles && safeFor(B, color, toIdx)) sc += H.safe;
      } else {
        const k = LEVEL_K[level];
        sc = m.to * 0.4 + Math.random() * k.noise;
        if (m.finishes) sc += 100;
        if (m.captures.length) {
          sc += 70 * k.cap;
          m.captures.forEach(o => { sc += Math.max(0, g.pawns[o.color][o.pawn]) * 0.6 * k.cap; });
        }
        if (m.leaves) sc += 45 * k.leave;
        if (m.to > LAST_TRACK && m.from <= LAST_TRACK) sc += 30;       // into the home lane
        if (g.settings.homeGate && m.to === LAST_TRACK) sc += 18;      // reached the gate tile
        const dFrom = danger(g, color, fromIdx), dTo = danger(g, color, toIdx);
        if (dFrom && !dTo) sc += 28 * k.dng;
        if (dTo) sc -= 22 * dTo * k.dng;
        if (toIdx !== null && g.settings.safeTiles && safeFor(B, color, toIdx)) sc += 10 * k.dng;
      }
      if (sc > bestScore) { bestScore = sc; best = m; }
    });
    return best.pawn;
  }

  // ---- Replay ------------------------------------------------------------------
  // A game is fully described by its start (settings, seat colours, first player) plus the dice
  // values and pawn choices in order: digits '1'-'6' = a roll, letters 'a'-'d' = move pawn 0-3.
  // Returns every position (states[0] = start) and, for states[i+1], the step that led to it.
  function replayStates(rep) {
    let g = newGame(normalizeSettings(rep.settings), rep.colors, rep.first);
    const states = [g], steps = [];
    const ev = String(rep.ev || '').replace(/[^1-6a-d]/g, '');
    for (let i = 0; i < ev.length;) {
      const ch = ev[i];
      if (ch < '1' || ch > '6') { i++; continue; }                  // stray move letter
      const before = g, value = +ch; g = roll(g, value); i++;
      if (g === before) continue;
      let pawn = null, lost = false;
      if ((g.phase === 'move' || g.phase === 'penalty') && i < ev.length && ev[i] >= 'a' && ev[i] <= 'd') {
        const g2 = g.phase === 'penalty' ? losePawn(g, ev.charCodeAt(i) - 97) : move(g, ev.charCodeAt(i) - 97);
        if (g2 !== g) { lost = g.phase === 'penalty'; g = g2; pawn = ev.charCodeAt(i) - 97; }
        i++;
      }
      steps.push({ color: before.turn, value, pawn, lost }); states.push(g);
      if (g.phase === 'over') break;
    }
    return { states, steps };
  }

  const api = {
    COLORS, START, TRACK, LAST_TRACK, FINISH, SAFE, TRACK_XY, LANE_XY,   // classic board (old names)
    BOARDS, BOARD_IDS, DEFAULT_BOARD, boardOf, safeFor, PALETTES, PALETTE_IDS, DEFAULT_PALETTE, BOT_LEVELS, HARD_TUNE: HARD, LEVEL_K, replayStates,
    DEFAULT_SETTINGS, SETTINGS_META,
    normalizeSettings, normalize, newGame, legalMoves, evalMove, roll, move, botChoose, losePawn, botLose, penaltyPawns,
    trackIdx, isDone, nextColor, clone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ludo = api;
})(typeof window !== 'undefined' ? window : globalThis);
