// ludo-ui.js — screens, board rendering, animations, bot/autoplay driver.
// Reads room state from Net, writes only through Net's actions.

(function () {
  'use strict';
  const L = Ludo;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const COLOR_HEX = { red: '#ef4444', green: '#22c55e', yellow: '#facc15', blue: '#3b82f6' };
  const DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const BASE_ORG = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
  const BASE_SLOTS = [[2, 2], [4, 2], [2, 4], [4, 4]];
  const HOME_DIR = { red: [-1, 0], green: [0, -1], yellow: [1, 0], blue: [0, 1] };
  const DICE_MS = 850, HOP_MS = 150;

  const U = {
    screen: 'loading', dp: null, pending: 0, gen: 0, chain: Promise.resolve(),
    seenMove: 0, seenRoll: 0, seenLoss: 0, dieReveal: true, dieValue: 1, dieColor: 'red', dieTimer: null, diceTok: 0, afterDice: [],
    palette: 'classic', replay: null, trailKey: null, kbHit: null, turnBuzz: -1,
    driven: null, wasSeated: false, boardBuilt: false, lastGameKey: null, modalFor: null, hoverMove: null
  };

  // ---- palette: seat keys stay red/green/yellow/blue, only the paint changes (room setting) ----
  function applyPalette(id) {
    id = L.PALETTES[id] ? id : L.DEFAULT_PALETTE; U.palette = id;
    Object.assign(COLOR_HEX, L.PALETTES[id].hex); document.body.dataset.palette = id;
  }
  const cname = c => t((U.palette === 'picture' ? 'colors2.' : 'colors.') + c);
  // bots have no stored name: "<colour> Bot", so it follows the palette
  const nameOf = (room, c) => { const s = room && room.seats[c]; return (s && s.name) || (cname(c) + (s && s.bot ? ' Bot' : '')); };
  // the room being drawn: the live one, or the recorded game while watching a replay
  const viewRoom = () => (U.replay ? U.replay.room : Net.S.room);
  // Haptics follow the sound switch; only for things that happen to *my* pawns.
  function buzz(pattern) {
    try { if ((typeof soundEnabled === 'undefined' || soundEnabled) && navigator.vibrate && !document.hidden) navigator.vibrate(pattern); } catch (e) {}
  }
  const mineSeat = (room, c) => !!room && Net.canActFor(room, c) && !U.replay;

  // ============================== screens =====================================
  function showScreen(name) {
    U.screen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + name).classList.add('active');
  }
  let toastTimer;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function closeModal() { $('modal').innerHTML = ''; $('modal').classList.remove('open'); U.modalFor = null; U.modalRebuild = null; }
  // `rebuild` re-opens the same dialog from scratch (used when the language changes while it is open)
  function openModal(html, key, rebuild) {
    $('modal').innerHTML = `<div class="modal-backdrop"></div><div class="modal-card">${html}</div>`;
    $('modal').classList.add('open'); U.modalFor = key || null; U.modalRebuild = rebuild || null;
  }

  // Language pickers are built from whatever is in I18N, so a new language shows up automatically.
  function buildLangSelects() {
    ['lang-select-lobby', 'lang-select-game'].forEach(id => {
      const sel = $(id); if (!sel) return;
      const codes = availableLangs();
      if (sel.options.length !== codes.length || codes.some((c, i) => sel.options[i].value !== c)) {
        sel.innerHTML = codes.map(c => `<option value="${esc(c)}">🌐 ${esc(langName(c))}</option>`).join('');
      }
      sel.value = LANG;
    });
  }

  function applyStaticText() {
    const meta = (I18N[LANG] && I18N[LANG].meta) || {};
    document.documentElement.lang = meta.htmlLang || LANG;
    document.documentElement.dir = meta.dir === 'rtl' ? 'rtl' : 'ltr';
    buildLangSelects();
    $('lobby-title').textContent = t('title'); $('lobby-sub').textContent = t('subtitle');
    $('lbl-name').textContent = t('yourName'); $('input-name').placeholder = t('namePh');
    $('tab-btn-create').textContent = t('tabCreate'); $('tab-btn-join').textContent = t('tabJoin'); $('tab-btn-offline').textContent = t('tabOffline');
    $('btn-create-room').textContent = t('createRoom'); $('btn-join-room').textContent = t('joinRoom');
    $('lbl-code').textContent = t('roomCode'); $('input-room-code').placeholder = t('codePh');
    $('offline-hint').textContent = t('offlineHint'); $('btn-start-offline').textContent = t('startOffline');
    $('online-off-note').textContent = t('onlineOff');
    $('seats-title').textContent = t('seats'); $('rules-title').textContent = t('houseRules');
    $('rules-readonly-hint').textContent = t('hostOnly');
    $('btn-leave-waiting').textContent = t('leave'); $('btn-leave-game').textContent = t('leave');
    $('btn-rules').textContent = '📋 ' + t('rules');
    $('game-title').textContent = t('title'); $('spectator-badge').textContent = t('spectating');
    $('room-code-label').textContent = t('roomCodeShare');
    $('btn-sound').textContent = soundEnabled ? '🔊' : '🔇';
    document.title = t('Ludo | MILF horses near you'); paintInvite();
  }

  // ============================== board =======================================
  const START_ARROW = { red: '→', green: '↓', yellow: '←', blue: '↑' };   // direction a pawn leaves its start tile
  const boardOfRoom = room => L.boardOf(room && room.g);

  function buildBoard(B) {
    B = B || L.BOARDS[L.DEFAULT_BOARD];
    const b = $('board'); b.innerHTML = ''; b.className = 'board-' + B.id; U.boardId = B.id;
    const grid = document.createElement('div'); grid.className = 'board-grid'; b.appendChild(grid);
    const put = (el, c, r, cs = 1, rs = 1) => { el.style.gridColumn = `${c + 1} / span ${cs}`; el.style.gridRow = `${r + 1} / span ${rs}`; grid.appendChild(el); return el; };
    L.COLORS.forEach(c => {
      const [ox, oy] = BASE_ORG[c];
      const base = put(document.createElement('div'), ox, oy, 6, 6); base.className = `base c-${c}`; base.dataset.color = c;
      const yard = document.createElement('div'); yard.className = 'yard';
      for (let i = 0; i < 4; i++) { const s = document.createElement('i'); yard.appendChild(s); }
      base.appendChild(yard);
    });
    B.TRACK_XY.forEach(([x, y], idx) => {
      const el = put(document.createElement('div'), x, y); el.className = 'cell track';
      const startOf = L.COLORS.find(c => B.START[c] === idx);
      if (startOf) {
        el.classList.add('start', 'c-' + startOf); el.dataset.dir = startOf;
        if (B.id === 'horse') el.innerHTML = `<span class="start-arrow">${START_ARROW[startOf]}</span>`; else el.textContent = '➜';
      } else if (B.SAFE.has(idx)) { el.classList.add('star'); el.textContent = '★'; }
      const gateOf = L.COLORS.find(c => L.trackIdx(c, B.LAST_TRACK, B) === idx);   // last white tile before a home lane
      if (gateOf) { el.dataset.gate = gateOf; el.classList.add('c-' + gateOf); }
    });
    L.COLORS.forEach(c => B.LANE_XY[c].forEach(([x, y], k) => {
      const el = put(document.createElement('div'), x, y); el.className = `cell lane c-${c}`;
      if (B.id === 'horse') el.textContent = k + 1;                    // lane steps are numbered 1..6
    }));
    const C = B.CENTER;
    const center = put(document.createElement('div'), C.x, C.y, C.w, C.h); center.className = 'center';
    const layer = document.createElement('div'); layer.className = 'pawn-layer'; layer.id = 'pawn-layer'; b.appendChild(layer);
    const marker = document.createElement('div'); marker.className = 'dest-marker'; marker.id = 'dest-marker'; layer.appendChild(marker);
    U.boardBuilt = true; U.lastGameKey = null; U.trailKey = null;
  }

  function cellPos(B, color, p, i) {
    if (p === -1) { const o = BASE_ORG[color], s = BASE_SLOTS[i]; return { x: o[0] + s[0], y: o[1] + s[1], key: null }; }
    if (p <= B.LAST_TRACK) { const idx = L.trackIdx(color, p, B); const [x, y] = B.TRACK_XY[idx]; return { x: x + .5, y: y + .5, key: 't' + idx }; }
    if (p < B.FINISH) { const [x, y] = B.LANE_XY[color][p - B.LAST_TRACK - 1]; return { x: x + .5, y: y + .5, key: 'l' + color + p }; }
    return { x: 7.5, y: 7.5, key: 'h' + color, home: true };
  }

  function renderPawns(room) {
    const g = room.g, layer = $('pawn-layer'), B = boardOfRoom(room);
    const dp = U.dp || g.pawns;
    const info = [];
    g.order.forEach(c => {
      for (let i = 0; i < (dp[c] || []).length; i++) { const p = dp[c][i]; info.push({ c, i, p, pos: cellPos(B, c, p, i) }); }
    });
    const groups = {};
    info.forEach(o => { if (o.pos.key) (groups[o.pos.key] = groups[o.pos.key] || []).push(o); });
    info.forEach(o => { if (!o.pos.key) { o.x = o.pos.x; o.y = o.pos.y; o.scale = 1; } });
    Object.values(groups).forEach(arr => {
      const n = arr.length;
      arr.forEach((o, k) => {
        if (o.pos.home) {
          const d = HOME_DIR[o.c];
          if (B.id === 'horse') {            // the centre is a single tile: park finished pawns small, in their colour's triangle
            const off = (k - (n - 1) / 2) * 0.17;
            o.x = 7.5 + d[0] * 0.3 - d[1] * off; o.y = 7.5 + d[1] * 0.3 + d[0] * off + .16; o.scale = .36;
          } else {
            const off = (k - (n - 1) / 2) * 0.36;
            o.x = 7.5 + d[0] * 0.95 - d[1] * off; o.y = 7.5 + d[1] * 0.95 + d[0] * off; o.scale = .62;
          }
        } else if (n === 1) { o.x = o.pos.x; o.y = o.pos.y; o.scale = 1; }
        else {
          const spread = n === 2 ? [[-.2, 0], [.2, 0]] : n === 3 ? [[-.22, .08], [.22, .08], [0, -.2]] : [[-.2, -.15], [.2, -.15], [-.2, .2], [.2, .2]];
          const s = spread[k % spread.length]; o.x = o.pos.x + s[0]; o.y = o.pos.y + s[1]; o.scale = n === 2 ? .82 : .72;
        }
      });
    });
    const canPick = canPickNow(room);
    const moves = canPick ? L.legalMoves(g, g.turn, g.die) : [];
    const movable = {}; moves.forEach(m => { movable[g.turn + m.pawn] = m; });
    // house rule: the player must give up one pawn -> every pawn they could lose is a (red) target
    const doomed = {}; if (canLoseNow(room)) L.penaltyPawns(g, g.turn).forEach(i => { doomed[g.turn + i] = true; });
    const target = Object.assign({}, movable, doomed), losing = !!Object.keys(doomed).length;
    const seen = new Set();
    info.forEach(o => {
      const id = 'pawn-' + o.c + o.i; seen.add(id);
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div'); el.id = id; el.className = `pawn c-${o.c}`;
        el.innerHTML = '<i class="p-shadow"></i><i class="p-body"></i><i class="p-head"></i>';
        layer.appendChild(el);                       // pawns are never click targets: their tile is (see below)
      }
      el.dataset.i = o.i; el.dataset.color = o.c;
      el.style.left = (o.x / 15 * 100) + '%'; el.style.top = (o.y / 15 * 100) + '%';
      el.style.setProperty('--scale', o.scale == null ? 1 : o.scale);
      el.style.zIndex = 10 + Math.round(o.y * 4) + (U.pending && U.movingId === id ? 300 : 0);
      el.classList.toggle('movable', !!movable[o.c + o.i]);
      el.classList.toggle('doomed', !!doomed[o.c + o.i]);
      el.classList.toggle('done', o.p === B.FINISH);
    });
    layer.querySelectorAll('.pawn').forEach(el => { if (!seen.has(el.id)) el.remove(); });

    // Clickable tiles: clicking the tile a movable pawn stands on picks that pawn. The pawn sprite hops
    // (so it can't be hit reliably) and ignores the mouse; the tile is steady and fills the whole cell.
    // Pawns sharing a tile share one target — they have the same progress, hence the same move.
    // Updated in place so a click is never lost to a re-render.
    const wantHits = new Set();
    info.forEach(o => {
      if (!target[o.c + o.i]) return;
      const hid = 'hit-' + o.c + '-' + o.pos.x + '-' + o.pos.y; wantHits.add(hid);
      let h = document.getElementById(hid);
      if (!h) {
        h = document.createElement('div'); h.id = hid; h.className = `tile-hit c-${o.c}`;
        h.addEventListener('click', () => onPawnClick(h.dataset.color, +h.dataset.i));
        h.addEventListener('mouseenter', () => showDest(h.dataset.color, +h.dataset.i));
        h.addEventListener('mouseleave', hideDest);
        layer.appendChild(h);
      }
      h.classList.toggle('danger', losing);
      if (!h.dataset.i || !target[o.c + h.dataset.i]) h.dataset.i = o.i;     // keep a still-valid pawn, else the first one here
      h.dataset.color = o.c;
      h.style.left = (o.pos.x / 15 * 100) + '%'; h.style.top = (o.pos.y / 15 * 100) + '%';
    });
    layer.querySelectorAll('.tile-hit').forEach(h => { if (!wantHits.has(h.id)) h.remove(); });
    document.querySelectorAll('.base').forEach(b => b.classList.toggle('active', room.status === 'playing' && g.turn === b.dataset.color));
    renderTrail(room, B); syncKb();
  }

  // Quiet "where did it go" cue: footprints (faint dots) along the path, a dashed ring on the tile the pawn
  // left and a soft glow on the tile it reached, all in the mover's colour. The footprints are dropped WHILE the
  // pawn walks (see enqueueMove) and the last 2 moves of the game stay visible — the older one fainter.
  function trailDot(B, lm, cls, p) {
    const layer = $('pawn-layer'); if (!layer) return;
    const pos = cellPos(B, lm.color, p, lm.pawn); if (pos.home) return;
    const d = document.createElement('div'); d.className = `trail ${cls} c-${lm.color}`; d.dataset.seq = lm.seq;
    d.style.left = (pos.x / 15 * 100) + '%'; d.style.top = (pos.y / 15 * 100) + '%'; layer.appendChild(d);
  }
  function drawTrail(B, lm, old) {
    const n0 = document.querySelectorAll('#pawn-layer .trail').length;
    (lm.path || []).forEach(p => { if (p !== lm.to && p !== lm.from) trailDot(B, lm, 'trail-step', p); });
    if (lm.from >= 0) trailDot(B, lm, 'trail-from', lm.from);
    trailDot(B, lm, 'trail-to', lm.to);
    if (old) document.querySelectorAll('#pawn-layer .trail').forEach((e, i) => { if (i >= n0) e.classList.add('trail-old'); });
  }
  // a move starts: footprints older than the previous move go, the previous move's fade
  function trailBegin(lm) {
    document.querySelectorAll('#pawn-layer .trail').forEach(e => {
      const sq = +e.dataset.seq;
      if (sq < lm.seq - 1) e.remove(); else if (sq < lm.seq) e.classList.add('trail-old');
    });
    U.trailKey = null;
  }
  function renderTrail(room, B) {
    const layer = $('pawn-layer'); if (!layer) return;
    if (U.pending || U.movingId) return;                       // mid-animation: footprints are being laid step by step
    const g = room.g, lm = g && g.lastMove, pm = g && g.prevMove;
    const key = lm ? B.id + ':' + lm.seq + ':' + (pm ? pm.seq : 0) : '';
    if (U.trailKey === key) return;
    U.trailKey = key; layer.querySelectorAll('.trail').forEach(e => e.remove());
    if (!key) return;
    if (pm) drawTrail(B, pm, true);
    drawTrail(B, lm, false);
  }
  function hitRing(lm, room) {
    const layer = $('pawn-layer'); if (!layer || !lm.captured.length) return;
    const B = L.boardOf(room.g), pos = cellPos(B, lm.color, lm.to, lm.pawn); if (pos.home) return;
    const d = document.createElement('div'); d.className = 'hit-ring c-' + lm.captured[0].color;
    d.style.left = (pos.x / 15 * 100) + '%'; d.style.top = (pos.y / 15 * 100) + '%'; layer.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  // ---- keyboard focus on movable tiles ----
  function hitList() {
    const room = viewRoom(), g = room && room.g;
    return [...document.querySelectorAll('.tile-hit')].sort((a, b) => ((g && g.pawns[b.dataset.color][+b.dataset.i]) || 0) - ((g && g.pawns[a.dataset.color][+a.dataset.i]) || 0));
  }
  function syncKb() {
    const list = hitList(); if (U.kbHit && !list.some(h => h.id === U.kbHit)) U.kbHit = null;
    list.forEach(h => h.classList.toggle('kb', h.id === U.kbHit));
  }
  function kbFocus(h) { U.kbHit = h ? h.id : null; syncKb(); if (h) showDest(h.dataset.color, +h.dataset.i); }

  function showDest(color, i) {
    const room = Net.S.room; if (!room || !room.g || !canPickNow(room) || room.g.turn !== color) return;
    const m = L.legalMoves(room.g, color, room.g.die).find(x => x.pawn === i); if (!m) return;
    const pos = cellPos(L.boardOf(room.g), color, m.to, i), mk = $('dest-marker');
    mk.style.left = (pos.x / 15 * 100) + '%'; mk.style.top = (pos.y / 15 * 100) + '%'; mk.className = 'dest-marker show c-' + color;
  }
  function hideDest() { const mk = $('dest-marker'); if (mk) mk.classList.remove('show'); }

  // ============================== dice ========================================
  function renderDie(value, tumbling) {
    const d = $('die'); d.className = 'die' + (tumbling ? ' tumble' : '') + ' c-' + U.dieColor;
    const pips = DIE_PIPS[value] || [];
    let h = ''; for (let i = 0; i < 9; i++) h += `<i class="${pips.includes(i) ? 'on' : ''}"></i>`;
    d.innerHTML = h;
  }
  // Nothing that depends on the roll (log line, next turn, sounds, pawn highlights, bot/auto moves)
  // is shown or played until the die has stopped: renderGame() is a no-op while it is tumbling and
  // sounds go through afterDice().
  function afterDice(fn) { if (U.dieReveal) fn(); else U.afterDice.push(fn); }
  function startDiceAnim(lr) {
    clearInterval(U.dieTimer);
    const tok = ++U.diceTok;
    U.dieReveal = false; U.dieColor = lr.color;
    $('btn-roll').disabled = true; $('btn-roll').textContent = t('rolling'); $('die-btn').classList.remove('ready'); hideDest();
    playSound('diceRoll'); { const rr = viewRoom(); if (rr && mineSeat(rr, lr.color)) buzz(10); }
    U.dieTimer = setInterval(() => { renderDie(Dice.roll(), true); }, 80);
    U.dieUntil = Date.now() + DICE_MS;
    setTimeout(() => {
      if (tok !== U.diceTok) return;                       // a newer roll replaced this animation
      clearInterval(U.dieTimer); U.dieReveal = true; U.dieValue = lr.value; renderDie(lr.value, false);
      { const rr = viewRoom(); if (lr.value === 6 && rr && mineSeat(rr, lr.color)) buzz([16, 40, 16]); }
      const room = viewRoom(); if (room && U.screen === 'game') { renderGame(room); }
      const q = U.afterDice; U.afterDice = []; q.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
      driver();
    }, DICE_MS);
  }
  async function waitDice() { while (!U.dieReveal) await sleep(40); }

  // ============================== animation ===================================
  function enqueueMove(lm, room) {
    const gen = U.gen; U.pending++;
    const id = 'pawn-' + lm.color + lm.pawn;
    U.chain = U.chain.then(async () => {
      if (gen !== U.gen) return;
      await waitDice(); await sleep(60);
      U.movingId = id;
      const TB = L.boardOf(viewRoom() && viewRoom().g); trailBegin(lm);
      for (let k = 0; k < lm.path.length; k++) {
        if (gen !== U.gen) return;
        // footprint on the tile being left: a dashed ring for the start tile, a dot for every tile walked over
        if (k === 0) { if (lm.from >= 0) trailDot(TB, lm, 'trail-from', lm.from); }
        else if (lm.path[k - 1] !== lm.from) trailDot(TB, lm, 'trail-step', lm.path[k - 1]);
        U.dp[lm.color][lm.pawn] = lm.path[k];
        const r = viewRoom(); if (r && r.g) renderPawns(r);
        playSound(lm.from === -1 ? 'leaveBase' : 'footstep');
        await sleep(U.replay ? HOP_MS / U.replay.speed : HOP_MS);
      }
      if (gen !== U.gen) return;
      lm.captured.forEach(o => { U.dp[o.color][o.pawn] = -1; });
      trailDot(TB, lm, 'trail-to', lm.to);
      const rr = viewRoom();
      if (lm.captured.length) {
        playSound('capture'); if (rr && rr.g) hitRing(lm, rr);
        if (lm.captured.some(o => mineSeat(rr, o.color))) buzz([70, 40, 70]); else if (mineSeat(rr, lm.color)) buzz([30, 30, 30]);
      }
      if (lm.to === L.boardOf(rr && rr.g).FINISH) { playSound('home'); if (mineSeat(rr, lm.color)) buzz([20, 30, 20, 30, 90]); }
      U.movingId = null;
      const r = viewRoom(); if (r && r.g) renderPawns(r);
      await sleep((lm.captured.length ? 450 : 120) / (U.replay ? U.replay.speed : 1));
    }).then(() => {
      if (gen !== U.gen) return;
      U.pending = Math.max(0, U.pending - 1);
      const r = viewRoom(); if (r && U.screen === 'game') renderGame(r);
      driver();
    });
  }

  // A pawn was given up (six penalty): red shock + X on its tile, then it is gone back to base.
  function enqueueLoss(ll, room) {
    const gen = U.gen; U.pending++;
    U.chain = U.chain.then(async () => {
      if (gen !== U.gen) return;
      await waitDice(); await sleep(60);
      const rr = viewRoom(), B = L.boardOf(rr && rr.g), pos = cellPos(B, ll.color, ll.from, ll.pawn), layer = $('pawn-layer');
      if (layer && !pos.home) {
        const d = document.createElement('div'); d.className = 'loss-ring';
        d.style.left = (pos.x / 15 * 100) + '%'; d.style.top = (pos.y / 15 * 100) + '%'; layer.appendChild(d);
        setTimeout(() => d.remove(), 1000);
      }
      playSound('capture'); if (mineSeat(rr, ll.color)) buzz([70, 40, 70]);
      await sleep(U.replay ? 520 / U.replay.speed : 520);
      if (gen !== U.gen) return;
      U.dp[ll.color][ll.pawn] = -1;
      const r = viewRoom(); if (r && r.g) renderPawns(r);
      await sleep(200);
    }).then(() => {
      if (gen !== U.gen) return;
      U.pending = Math.max(0, U.pending - 1);
      const r = viewRoom(); if (r && U.screen === 'game') renderGame(r);
      driver();
    });
  }

  // ============================== game rendering ==============================
  function canPickNow(room) {
    const g = room.g;
    return !U.replay && !!g && room.status === 'playing' && g.phase === 'move' && U.pending === 0 && U.dieReveal &&
      Net.canActFor(room, g.turn) && !Net.seatIsAutoplayed(room.seats[g.turn], Date.now());
  }
  function canLoseNow(room) {
    const g = room.g;
    return !U.replay && !!g && room.status === 'playing' && g.phase === 'penalty' && U.pending === 0 && U.dieReveal &&
      Net.canActFor(room, g.turn) && !Net.seatIsAutoplayed(room.seats[g.turn], Date.now());
  }
  function canRollNow(room) {
    const g = room.g;
    return !U.replay && !!g && room.status === 'playing' && g.phase === 'roll' && U.pending === 0 && U.dieReveal &&
      Net.canActFor(room, g.turn) && !Net.seatIsAutoplayed(room.seats[g.turn], Date.now());
  }

  function renderGame(room) {
    const g = room.g; if (!g) return;
    if (!U.dieReveal) return;                    // die still tumbling: don't leak the result (reveal re-renders)
    const B = boardOfRoom(room);
    if (!U.boardBuilt || U.boardId !== B.id) buildBoard(B);
    if (!U.dp) U.dp = L.clone(g.pawns);
    $('game-room-code-label').textContent = Net.S.mode === 'local' ? t('offlineRoom') : Net.S.code;
    $('spectator-badge').style.display = (!U.replay && Net.S.mode === 'online' && !Net.mySeatColor(room)) ? '' : 'none';
    document.querySelectorAll('.cell[data-gate]').forEach(el => el.classList.toggle('gate-on', !!room.settings.homeGate));
    renderPawns(room);

    const turnColor = g.turn, over = g.phase === 'over';
    const tb = $('turn-banner');
    const mine = !U.replay && Net.canActFor(room, turnColor) && Net.S.mode === 'online';
    const auto = Net.seatIsAutoplayed(room.seats[turnColor], Date.now()) && !room.seats[turnColor].bot;
    if (over) tb.innerHTML = `<span class="dot" style="background:${COLOR_HEX[g.winner]}"></span> ${esc(t('winTitle', nameOf(room, g.winner)))}`;
    else tb.innerHTML = `<span class="dot" style="background:${COLOR_HEX[turnColor]}"></span> <b>${esc(mine ? t('yourTurn') : t('turnOf', nameOf(room, turnColor)))}</b>` +
      (auto ? ` <small class="muted">(${t('autoplay')})</small>` : '') +
      (g.phase === 'penalty' ? ` <small class="lose-note">· ${t('losePickShort', g.sixes)}</small>` : '') +
      (g.phase === 'roll' && g.tries < 3 && g.settings.triesWhenStuck ? ` <small class="muted">· ${t('tries', g.tries)}</small>` : '');
    tb.style.borderColor = over ? COLOR_HEX[g.winner] : COLOR_HEX[turnColor];

    if (mine && g.phase === 'roll' && !over && U.turnBuzz !== g.v) { U.turnBuzz = g.v; buzz(14); }      // my turn: a tiny tick
    const roll = $('btn-roll'), rollable = canRollNow(room), pick = canPickNow(room);
    roll.disabled = !rollable;
    roll.textContent = !U.dieReveal ? t('rolling') : pick ? t('pickPawn') : canLoseNow(room) ? t('losePick') : t('rollBtn');
    $('die-btn').classList.toggle('ready', rollable);
    if (U.dieReveal && !$('die').firstChild) renderDie(U.dieValue, false);

    // players
    let ph = '';
    g.order.forEach(c => {
      const seat = room.seats[c] || {}; const done = g.pawns[c].filter(p => p === B.FINISH).length;
      const rank = g.ranking.indexOf(c);
      const away = !seat.bot && !seat.local && seat.connected === false;
      ph += `<div class="player-card c-${c}${c === turnColor && !over ? ' active' : ''}${away ? ' away' : ''}">
        <span class="swatch"></span>
        <div class="pc-main"><div class="pc-name">${esc(nameOf(room, c))}${seat.bot ? ` <em class="tag lvl-${Net.botLevel(seat)}">${t('bot')} · ${t('lvl.' + Net.botLevel(seat))}</em>` : ''}${seat.uid === Net.MY_UID && Net.S.mode === 'online' ? ` <em class="tag you">${t('you')}</em>` : ''}${away ? ` <em class="tag warn">${t('offline')}</em>` : ''}</div>
        <div class="pc-sub">${t('finishedCount', done, g.pawns[c].length)} <span class="pips">${g.pawns[c].map(p => `<i class="${p === B.FINISH ? 'on' : ''}"></i>`).join('')}</span></div></div>
        ${rank >= 0 ? `<span class="medal">${['🥇', '🥈', '🥉', '4️⃣'][rank]}</span>` : ''}</div>`;
    });
    $('player-panel').innerHTML = ph;

    // log (newest first)
    $('log-panel').innerHTML = g.log.slice().reverse().map(e => {
      const n = `<b style="color:${COLOR_HEX[e.c]}">${esc(nameOf(room, e.c))}</b>`;
      const o = e.o ? `<b style="color:${COLOR_HEX[e.o]}">${esc(nameOf(room, e.o))}</b>` : '';
      return `<div class="log-line k-${e.k}">${t('log.' + e.k, n, e.o ? o : e.d)}</div>`;
    }).join('');

    if (over && !U.replay && U.modalFor !== 'win') showWinModal(room);
    if (!over && U.modalFor === 'win') closeModal();
  }

  function showWinModal(room, quiet) {
    const g = room.g;
    const rows = g.ranking.map((c, i) => `<li><span class="medal">${['🥇', '🥈', '🥉', '4️⃣'][i]}</span><span class="dot" style="background:${COLOR_HEX[c]}"></span>${esc(nameOf(room, c))}</li>`).join('');
    const host = Net.isHost(room);
    openModal(`<h2>🏆 ${esc(t('winTitle', nameOf(room, g.winner)))}</h2><h3>${t('winFinal')}</h3><ol class="rank-list">${rows}</ol>
      ${room.replay && String(room.replay.ev).length > 3 ? `<button class="btn btn-secondary btn-block" id="btn-replay" style="margin-bottom:8px">${t('replayBtn')}</button>` : ''}
      ${host ? `<button class="btn btn-block" id="btn-rematch">${t('backToLobby')}</button>` : `<p class="muted" style="text-align:center">${t('playAgainHint')}</p>`}`, 'win',
      () => { const r = Net.S.room; if (r && r.g) showWinModal(r, true); });
    if (!quiet) { playSound('gameOver'); if (mineSeat(room, g.winner)) buzz([40, 40, 40, 40, 160]); }
    const b = $('btn-rematch'); if (b) b.onclick = () => Net.backToLobby();
    const rbtn = $('btn-replay'); if (rbtn) rbtn.onclick = () => startReplay(room);
  }

  function showRulesModal(room) {
    openModal(`<h2>📋 ${t('houseRules')}</h2><div id="rules-modal-list"></div><button class="btn btn-secondary btn-block" id="btn-close-modal">OK</button>`, 'rules',
      () => { const r = Net.S.room; if (r) showRulesModal(r); });
    renderRules($('rules-modal-list'), room.settings, false);
    $('btn-close-modal').onclick = closeModal;
    $('modal').querySelector('.modal-backdrop').onclick = closeModal;
  }

  // ============================== actions =====================================
  function onRoll() {
    const room = Net.S.room; if (!room || !canRollNow(room)) return;
    Net.doRoll(room.g.v, Dice.roll());
  }
  function onPawnClick(color, i) {
    const room = Net.S.room; if (!room) return;
    if (canLoseNow(room) && room.g.turn === color) {
      if (L.penaltyPawns(room.g, color).indexOf(i) < 0) return;
      U.kbHit = null; hideDest(); Net.doLose(room.g.v, i); return;
    }
    if (!canPickNow(room) || room.g.turn !== color) return;
    if (!L.legalMoves(room.g, color, room.g.die).some(m => m.pawn === i)) return;
    U.kbHit = null; hideDest(); Net.doMove(room.g.v, i);
  }

  // Bot / AFK / auto-move driver. Safe to call often.
  function driver() {
    const room = Net.S.room;
    if (U.replay || !room || room.status !== 'playing' || !room.g || U.screen !== 'game') return;
    const g = room.g;
    if (U.pending > 0 || !U.dieReveal) return;
    const seat = room.seats[g.turn]; const now = Date.now();
    let action = null, delay = 0;
    if (Net.seatIsAutoplayed(seat, now) && Net.isDriver(room)) {
      delay = g.phase === 'roll' ? 750 : 650;
      action = g.phase === 'roll'
        ? () => Net.doRoll(g.v, Dice.roll())
        : g.phase === 'penalty'
        ? () => { const p = L.botLose(g, g.turn); return p === null ? null : Net.doLose(g.v, p); }
        : () => { const p = L.botChoose(g, g.turn, Net.botLevel(seat)); return p === null ? null : Net.doMove(g.v, p); };
    } else if (Net.canActFor(room, g.turn) && g.phase === 'move' && g.settings.autoMove) {
      const moves = L.legalMoves(g, g.turn, g.die);
      if (moves.length === 1) { delay = 500; action = () => Net.doMove(g.v, moves[0].pawn); }
    }
    if (!action) {
      if (seat && !seat.bot && !seat.local && seat.connected === false) setTimeout(driver, 1500); // wait out AFK grace
      return;
    }
    const key = g.v + ':' + g.phase;
    if (U.driven === key) return;
    U.driven = key;
    setTimeout(async () => {
      const cur = Net.S.room;
      if (cur && cur.g && cur.g.v === g.v) { try { await action(); } catch (e) { console.error(e); } }
      if (U.driven === key) U.driven = null;
      setTimeout(driver, 50);
    }, delay);
  }

  // ============================== state changes ===============================
  function onRoomChange(room, prev) {
    if (room) applyPalette(room.settings.palette);
    if (U.replay && room) return;                 // watching a replay: live updates wait until we exit
    if (!room) {
      if (Net.S.mode === 'online') { toast(t('noRoom')); leaveToLobby(); }
      return;
    }
    const seated = Net.S.mode === 'local' || !!Net.mySeatColor(room);
    if (U.wasSeated && !seated && room.status === 'lobby' && Net.S.mode === 'online') { toast(t('kicked')); leaveToLobby(); return; }
    U.wasSeated = seated;

    if (room.status === 'lobby') {
      U.dp = null; U.gen++; U.pending = 0; U.chain = Promise.resolve(); U.boardBuilt = false; U.driven = null;
      if (U.screen !== 'waiting') U.rulesKey = null;
      if (U.modalFor === 'win') closeModal();
      showScreen('waiting'); renderWaiting(room); return;
    }
    // playing / ended
    const g = room.g;
    const fresh = U.screen !== 'game' || !prev || prev.status === 'lobby' || !prev.g || g.v < prev.g.v || !U.dp;
    if (fresh) {
      U.gen++; U.pending = 0; U.chain = Promise.resolve(); U.boardBuilt = false;
      U.dp = L.clone(g.pawns); U.seenMove = g.moveSeq; U.seenRoll = g.rollSeq; U.seenLoss = g.lossSeq || 0;
      U.dieReveal = true; U.dieValue = g.lastRoll ? g.lastRoll.value : 1; U.dieColor = g.lastRoll ? g.lastRoll.color : g.turn;
      U.driven = null; U.afterDice = []; U.diceTok++;
      showScreen('game'); renderDie(U.dieValue, false);
      if (prev && prev.status === 'lobby') playSound('gameStart');
    } else {
      if (g.rollSeq > U.seenRoll) { U.seenRoll = g.rollSeq; startDiceAnim(g.lastRoll); }
      if (g.moveSeq > U.seenMove) { U.seenMove = g.moveSeq; enqueueMove(g.lastMove, room); }
      if ((g.lossSeq || 0) > U.seenLoss) { U.seenLoss = g.lossSeq; if (g.lastLoss) enqueueLoss(g.lastLoss, room); }
      if (g.phase === 'roll' && prev && prev.g && prev.g.turn !== g.turn && g.moveSeq === U.seenMove && U.pending === 0) afterDice(() => playSound('endTurn'));
      if (g.phase === 'roll' && g.log.length && g.log[g.log.length - 1].k === 'pass') afterDice(() => playSound('pass'));
    }
    renderGame(room);
    driver();
  }

  // Asks before leaving; `where` is 'waiting' or 'game'. Enter/Esc work, focus lands on the safe choice.
  function confirmLeave(where) {
    const body = where === 'waiting' ? t('leaveWaitingBody') : Net.S.mode === 'online' ? t('leaveGameOnlineBody') : t('leaveGameLocalBody');
    openModal(`<h2>${esc(t('leaveTitle'))}</h2><p class="muted" style="text-align:center">${esc(body)}</p>
      <div class="confirm-actions"><button class="btn btn-secondary" id="leave-stay">${esc(t('leaveStay'))}</button><button class="btn btn-danger" id="leave-go">${esc(t('leaveGo'))}</button></div>`, 'leave', () => confirmLeave(where));
    $('leave-stay').onclick = closeModal;
    $('modal').querySelector('.modal-backdrop').onclick = closeModal;
    $('leave-go').onclick = async () => { closeModal(); await Net.leaveSeat(); if (where === 'waiting') forgetRoom(); leaveToLobby(); };
    $('leave-stay').focus();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && U.modalFor === 'leave') closeModal(); });

  function leaveToLobby() {
    U.replay = null; $('replay-bar').style.display = 'none'; $('replay-badge').style.display = 'none'; document.querySelector('.dice-area').style.display = '';
    applyPalette('classic');
    clearInterval(U.dieTimer); U.gen++; U.pending = 0; U.dp = null; U.boardBuilt = false; U.wasSeated = false; U.driven = null;
    closeModal();
    Net.detach(); try { history.replaceState(null, '', location.pathname); } catch (e) {}
    refreshResume();
    showScreen('lobby');
  }

  // ============================== waiting room ================================
  function renderRules(container, settings, editable) {
    container.innerHTML = '';
    L.SETTINGS_META.forEach(m => {
      const [label, desc] = t('set.' + m.key).constructor === Array ? t('set.' + m.key) : [m.key, ''];
      const row = document.createElement('div');
      const inside = m.type === 'choice' || m.type === 'board' || m.type === 'palette';          // controls that sit under the text
      const dep = m.dependsOn && !settings[m.dependsOn];
      const over = m.overriddenBy && settings[m.overriddenBy];      // a parent rule makes this one pointless
      const locked = !editable || over;
      const parentLabel = over ? String(t('set.' + m.overriddenBy)[0]) : '';
      row.className = 'rule-row' + (dep || over ? ' dim' : '') + (m.key === 'noJump' ? ' rule-parent' : '') + (m.type === 'board' || m.type === 'palette' ? ' rule-board' : '');
      let ctl = '';
      if (m.type === 'board') {
        ctl = `<div class="board-picker" role="radiogroup" aria-label="${esc(label)}">${m.options.map(id => {
          const [bn, bd] = t('boards.' + id), on = settings.board === id;
          return `<button type="button" class="board-card${on ? ' selected' : ''}${editable ? '' : ' readonly'}" data-board="${id}" role="radio" aria-checked="${on}" ${editable ? '' : 'tabindex="-1"'}>
            <span class="board-thumb">${BoardThumb.svg(id, L, undefined, settings.palette)}</span>
            <strong>${esc(bn)}${id === L.DEFAULT_BOARD ? ` <em class="tag">${esc(t('defaultTag'))}</em>` : ''}</strong>
            <small>${esc(bd)}</small></button>`;
        }).join('')}</div>`;
      } else if (m.type === 'palette') {
        ctl = `<div class="palette-picker" role="radiogroup" aria-label="${esc(label)}">${m.options.map(id => {
          const [pn, pd] = t('palettes.' + id), on = settings.palette === id;
          return `<button type="button" class="palette-card${on ? ' selected' : ''}${editable ? '' : ' readonly'}" data-palette="${id}" role="radio" aria-checked="${on}" ${editable ? '' : 'tabindex="-1"'}>
            <span class="palette-swatches">${L.COLORS.map(c => `<i style="background:${L.PALETTES[id].hex[c]}"></i>`).join('')}</span>
            <strong>${esc(pn)}</strong><small>${esc(pd)}</small></button>`;
        }).join('')}</div>`;
      } else if (m.type === 'bool') {
        ctl = `<label class="switch"><input type="checkbox" data-key="${m.key}" ${settings[m.key] ? 'checked' : ''} ${locked ? 'disabled' : ''}><span class="slider"></span></label>`;
      } else if (m.type === 'num') {
        ctl = `<div class="stepper"><button type="button" data-step="-1" data-key="${m.key}" ${locked ? 'disabled' : ''}>−</button><b>${settings[m.key]}</b><button type="button" data-step="1" data-key="${m.key}" ${locked ? 'disabled' : ''}>+</button></div>`;
      } else {
        ctl = `<div class="radio-pair">${m.options.map(o => `<label class="radio-option"><input type="radio" name="r-${m.key}" data-key="${m.key}" value="${o}" ${settings[m.key] === o ? 'checked' : ''} ${editable ? '' : 'disabled'}><span>${t('choice.' + o)}</span></label>`).join('')}</div>`;
      }
      row.innerHTML = `<div class="rule-text"><strong>${esc(label)}</strong><small>${esc(desc)}</small>${over ? `<small class="override-note">⚠ ${esc(t('overridden', parentLabel))}</small>` : ''}${inside ? ctl : ''}</div>${inside ? '' : ctl}`;
      container.appendChild(row);
    });
    if (!editable) return;
    container.querySelectorAll('.board-card[data-board]').forEach(b => b.onclick = () => Net.setSetting('board', b.dataset.board));
    container.querySelectorAll('.palette-card[data-palette]').forEach(b => b.onclick = () => Net.setSetting('palette', b.dataset.palette));
    container.querySelectorAll('input[type=checkbox]').forEach(i => i.onchange = () => Net.setSetting(i.dataset.key, i.checked));
    container.querySelectorAll('input[type=radio]').forEach(i => i.onchange = () => Net.setSetting(i.dataset.key, i.value));
    container.querySelectorAll('.stepper button').forEach(b => b.onclick = () => {
      const m = L.SETTINGS_META.find(x => x.key === b.dataset.key);
      Net.stepSetting(m.key, +b.dataset.step, m.min, m.max);
    });
  }

  function renderWaiting(room) {
    const local = Net.S.mode === 'local', host = Net.isHost(room);
    $('room-code-box').style.display = local ? 'none' : '';
    $('room-code-display').textContent = Net.S.code || '-----';
    const grid = $('seat-grid'); grid.innerHTML = '';
    const me = Net.mySeatColor(room);
    L.COLORS.forEach(c => {
      const s = room.seats[c]; const card = document.createElement('div');
      card.className = `seat c-${c}${s ? ' taken' : ''}`;
      let inner = `<span class="swatch"></span><div class="seat-main"><div class="seat-color">${cname(c)}</div>`;
      if (s) {
        inner += `<div class="seat-name">${esc(nameOf(room, c))} ${s.bot ? (host || local ? `<button type="button" class="tag lvl-${Net.botLevel(s)}" data-act="level" data-color="${c}" title="${esc(t('lvlTip'))}">${t('lvl.' + Net.botLevel(s))}</button>` : `<em class="tag lvl-${Net.botLevel(s)}">${t('lvl.' + Net.botLevel(s))}</em>`) : ''}${s.uid === room.hostUid ? `<em class="tag host">${t('host')}</em>` : ''}${s.uid === Net.MY_UID ? `<em class="tag you">${t('you')}</em>` : ''}</div></div>`;
        const canRemove = host && (local ? true : s.uid !== Net.MY_UID);
        if (canRemove) inner += `<button class="mini-btn danger" data-act="remove" data-color="${c}">${s.bot || local ? t('remove') : t('kick')}</button>`;
      } else {
        inner += `<div class="seat-name muted">${t('empty')}</div></div>`;
        if (local || host) inner += `<button class="mini-btn" data-act="bot" data-color="${c}">${t('addBot')}</button>`;
        if (local) inner += `<button class="mini-btn" data-act="human" data-color="${c}">${t('addHuman')}</button>`;
        else if (me) inner += `<button class="mini-btn" data-act="sit" data-color="${c}">${t('sit')}</button>`;
      }
      card.innerHTML = inner; grid.appendChild(card);
    });
    grid.querySelectorAll('button').forEach(b => b.onclick = () => {
      const c = b.dataset.color, a = b.dataset.act;
      if (a === 'bot') Net.addSeat(c, 'bot'); else if (a === 'human') Net.addSeat(c, 'human');
      else if (a === 'remove') Net.removeSeat(c); else if (a === 'sit') Net.sit(c);
      else if (a === 'level') { const cur = Net.botLevel(room.seats[c]), lv = L.BOT_LEVELS; Net.setBotLevel(c, lv[(lv.indexOf(cur) + 1) % lv.length]); }
    });
    if (local) grid.querySelectorAll('.seat.taken .seat-name').forEach(el => {
      el.style.cursor = 'pointer';
      el.onclick = () => {
        const c = [...grid.children].indexOf(el.closest('.seat')); const col = L.COLORS[c];
        const seat = room.seats[col]; if (!seat || seat.bot) return;
        const n = prompt(t('yourName'), seat.name); if (n && n.trim()) Net.renameSeat(col, n.trim());
      };
    });
    const rk = JSON.stringify([room.settings, host, LANG, U.palette]);
    if (U.rulesKey !== rk) { U.rulesKey = rk; renderRules($('rules-list'), room.settings, host); }   // only rebuild when rules changed
    $('rules-readonly-hint').style.display = host ? 'none' : '';
    const rb = $('btn-replay-waiting'); rb.style.display = room.replay && String(room.replay.ev).length > 3 ? '' : 'none'; rb.textContent = t('replayLast');
    const count = Object.keys(room.seats).length;
    $('btn-start-game').style.display = host ? '' : 'none';
    $('btn-start-game').textContent = t('start'); $('btn-start-game').disabled = count < 2;
    $('waiting-hint').textContent = host ? (count < 2 ? t('needTwo') : '') : t('waitHost');
  }

  // ============================== replay ======================================
  // A finished game is just its start + every roll/move (room.replay.ev), so it is rebuilt with the
  // engine and stepped through here. No network: everything below runs on a private "room".
  function startReplay(room) {
    const rep = room && room.replay; if (!rep || String(rep.ev).length < 3) return;
    const { states, steps } = L.replayStates(rep);
    closeModal(); clearInterval(U.dieTimer);
    const settings = L.normalizeSettings(rep.settings || room.settings);
    U.replay = { states, steps, idx: 0, playing: false, speed: 1, tok: 0,
      room: { status: 'playing', seats: room.seats, settings, hostUid: room.hostUid, g: states[0] } };
    applyPalette(settings.palette);
    U.gen++; U.pending = 0; U.chain = Promise.resolve(); U.movingId = null; U.afterDice = [];
    U.boardBuilt = false; U.trailKey = null; U.dp = L.clone(states[0].pawns); U.dieReveal = true; U.dieColor = states[0].turn; U.kbHit = null;
    showScreen('game');
    $('replay-bar').style.display = ''; document.querySelector('.dice-area').style.display = 'none';
    $('replay-badge').style.display = ''; $('replay-badge').textContent = t('replayBadge'); $('spectator-badge').style.display = 'none';
    renderDie(1, false); renderGame(U.replay.room); updateReplayBar();
  }
  function rpGo(idx, animate) {
    const rp = U.replay; if (!rp) return;
    idx = Math.max(0, Math.min(rp.states.length - 1, idx));
    const prev = rp.idx; rp.idx = idx; const g = rp.states[idx]; rp.room.g = g;
    const st = idx > 0 ? rp.steps[idx - 1] : null;
    U.dieColor = st ? st.color : g.turn; renderDie(st ? st.value : 1, false);
    if (animate && idx === prev + 1 && st && st.pawn !== null && !st.lost && g.lastMove) {
      enqueueMove(g.lastMove, rp.room);                       // hops along the real path
    } else {
      U.gen++; U.pending = 0; U.chain = Promise.resolve(); U.movingId = null; U.dp = L.clone(g.pawns);
    }
    renderGame(rp.room); updateReplayBar();
  }
  async function rpPlay() {
    const rp = U.replay; if (!rp) return;
    if (rp.idx >= rp.states.length - 1) rpGo(0, false);
    rp.playing = true; const tok = ++rp.tok; updateReplayBar();
    while (U.replay === rp && rp.playing && tok === rp.tok && rp.idx < rp.states.length - 1) {
      rpGo(rp.idx + 1, true);
      const st = rp.steps[rp.idx - 1];
      await sleep((st && st.pawn !== null ? 650 : 520) / rp.speed);
      while (U.pending > 0 && U.replay === rp) await sleep(40);
    }
    if (U.replay === rp && tok === rp.tok) { rp.playing = false; updateReplayBar(); }
  }
  function rpPause() { const rp = U.replay; if (rp) { rp.playing = false; rp.tok++; updateReplayBar(); } }
  const rpToggle = () => { const rp = U.replay; if (!rp) return; if (rp.playing) rpPause(); else rpPlay(); };
  function updateReplayBar() {
    const rp = U.replay; if (!rp) return;
    const max = rp.states.length - 1;
    const sl = $('rp-slider'); sl.max = max; sl.value = rp.idx;
    $('rp-play').textContent = rp.playing ? '⏸' : '▶';
    $('rp-info').textContent = t('replayStep', rp.idx, max); $('rp-speed').textContent = rp.speed + '×';
    $('rp-speed').title = t('replaySpeed'); $('rp-exit').textContent = t('replayExit'); $('replay-badge').textContent = t('replayBadge');
  }
  function exitReplay() {
    const rp = U.replay; if (!rp) return;
    rp.playing = false; rp.tok++; U.replay = null;
    $('replay-bar').style.display = 'none'; $('replay-badge').style.display = 'none'; document.querySelector('.dice-area').style.display = '';
    U.gen++; U.pending = 0; U.chain = Promise.resolve(); U.movingId = null;
    U.boardBuilt = false; U.dp = null; U.trailKey = null; U.driven = null; U.kbHit = null; closeModal();
    const r = Net.S.room; if (r) onRoomChange(r, null); else leaveToLobby();
  }

  // ============================== rejoin my old seat ==========================
  const LAST_KEY = 'ludo_last';
  function rememberRoom(code) { try { localStorage.setItem(LAST_KEY, JSON.stringify({ code, ts: Date.now() })); } catch (e) {} }
  function forgetRoom() { try { localStorage.removeItem(LAST_KEY); } catch (e) {} const c = $('resume-card'); if (c) c.style.display = 'none'; }
  async function refreshResume() {
    const card = $('resume-card'); if (!card) return;
    card.style.display = 'none';
    let last = null; try { last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) {}
    if (!last || !last.code || !Net.ONLINE_OK || Date.now() - (last.ts || 0) > 36e5 * 24) return;
    const p = await Net.peek(last.code);
    if (!p || !p.color) { forgetRoom(); return; }                      // room gone, or my seat was freed
    if (U.screen !== 'lobby') return;
    U.resumeInfo = p; paintResume(true);
    $('btn-resume').onclick = async () => {
      try {
        const code = await Net.tryRejoin(p.code);
        if (!code) { toast(t('resumeGone')); forgetRoom(); return; }
        rememberRoom(code); location.hash = code;
      } catch (e) { console.error(e); toast(t('onlineOff')); }
    };
    card.style.display = '';
  }
  function paintResume(force) {
    const p = U.resumeInfo, card = $('resume-card'); if (!p || !card || (!force && card.style.display === 'none')) return;
    $('resume-title').textContent = t('resumeTitle'); $('resume-body').textContent = t('resumeBody', p.code, p.status);
    $('btn-resume').textContent = t('resumeBtn');
  }
  // A spectator can take over a seat whose player left (new device, cleared storage…).
  function offerClaim() {
    const room = Net.S.room; if (!room || Net.S.mode !== 'online' || Net.mySeatColor(room)) return;
    const free = Net.claimableSeats(room);
    if (!free.length) return;
    const rows = free.map(c => `<button type="button" class="btn btn-secondary btn-block claim-btn" data-claim="${c}"><span class="dot" style="background:${COLOR_HEX[c]}"></span> ${esc(nameOf(room, c))} <small class="muted">· ${esc(cname(c))}</small></button>`).join('');
    openModal(`<h2>${esc(t('claimTitle'))}</h2><p class="muted" style="text-align:center">${esc(t('claimBody'))}</p>${rows}
      <button type="button" class="btn btn-secondary btn-block" id="claim-watch" style="margin-top:6px">${esc(t('claimWatch'))}</button>`, 'claim', offerClaim);
    $('modal').querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => {
      const ok = await Net.claimSeat(b.dataset.claim, myName());
      closeModal(); toast(t(ok ? 'claimedToast' : 'claimFail'));
      if (ok) rememberRoom(Net.S.code);
    });
    $('claim-watch').onclick = closeModal; $('modal').querySelector('.modal-backdrop').onclick = closeModal;
  }

  // ============================== keyboard ====================================
  // Space / Enter: roll, then (when a choice is needed) cycle-and-confirm a tile with the arrows.
  // 1-4 picks that pawn directly. During a replay: Space = play/pause, ←/→ = step, Home/End = jump.
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || U.screen !== 'game' || U.modalFor) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) && !(tag === 'INPUT' && document.activeElement.id === 'rp-slider')) return;
    const k = e.key, act = k === ' ' || k === 'Enter';
    if (act && tag === 'BUTTON') return;                        // a focused button handles its own press
    if (U.replay) {
      if (act) { e.preventDefault(); if (!e.repeat) rpToggle(); }
      else if (k === 'ArrowRight') { e.preventDefault(); rpPause(); rpGo(U.replay.idx + 1, true); }
      else if (k === 'ArrowLeft') { e.preventDefault(); rpPause(); rpGo(U.replay.idx - 1, false); }
      else if (k === 'Home') { e.preventDefault(); rpPause(); rpGo(0, false); }
      else if (k === 'End') { e.preventDefault(); rpPause(); rpGo(1e9, false); }
      return;
    }
    const room = Net.S.room; if (!room || !room.g) return;
    if (act) {
      e.preventDefault(); if (e.repeat) return;
      if (canRollNow(room)) { onRoll(); return; }
      if (canPickNow(room) || canLoseNow(room)) {
        const list = hitList(); if (!list.length) return;
        const cur = list.find(h => h.id === U.kbHit);
        if (cur) onPawnClick(cur.dataset.color, +cur.dataset.i); else kbFocus(list[0]);
      }
      return;
    }
    if (!canPickNow(room) && !canLoseNow(room)) return;
    const list = hitList(); if (!list.length) return;
    if (/^Arrow(Right|Down)$/.test(k) || /^Arrow(Left|Up)$/.test(k)) {
      e.preventDefault();
      const d = /Right|Down/.test(k) ? 1 : -1, at = list.findIndex(h => h.id === U.kbHit);
      kbFocus(list[at < 0 ? (d > 0 ? 0 : list.length - 1) : (at + d + list.length) % list.length]);
    } else if (/^[1-4]$/.test(k)) onPawnClick(room.g.turn, +k - 1);
  }

  // ============================== lobby wiring ================================
  function myName() {
    const n = $('input-name').value.trim();
    try { if (n) localStorage.setItem('ludo_name', n); } catch (e) {}
    return n;
  }
  function wire() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active'); $('tab-' + btn.dataset.tab).classList.add('active');
    }));
    const refreshLang = () => {
      applyStaticText();
      const r = Net.S.room; if (r) onRoomChangeRerender(r);
      if (U.modalFor && U.modalRebuild) U.modalRebuild();      // an open dialog (rules, leave, results…) is rebuilt in the new language
      paintResume();                                           // so is the "rejoin" card in the lobby
    };
    const onLang = e => { setLang(e.target.value); refreshLang(); };
    // language changed in another tab of the same site: follow it
    window.addEventListener('storage', e => { if (e.key === 'ludo_lang' && hasLang(e.newValue) && e.newValue !== LANG) { LANG = e.newValue; refreshLang(); } });
    $('lang-select-lobby').onchange = onLang; $('lang-select-game').onchange = onLang;
    $('btn-sound').onclick = () => { setSoundEnabled(!soundEnabled); applyStaticText(); };
    $('btn-create-room').onclick = async () => {
      const n = myName(); if (!n) return toast(t('nameNeeded'));
      if (!Net.ONLINE_OK) return toast(t('onlineOff'));
      try { const code = await Net.createOnline(n); rememberRoom(code); location.hash = code; } catch (e) { console.error(e); toast(t('onlineOff')); }
    };
    $('btn-join-room').onclick = async () => {
      const n = myName(); if (!n) return toast(t('nameNeeded'));
      const code = $('input-room-code').value.trim(); if (!code) return;
      if (!Net.ONLINE_OK) return toast(t('onlineOff'));
      try {
        const r = await Net.joinOnline(code, n);
        if (!r.ok) return toast(t(r.reason));
        rememberRoom(code.toUpperCase()); U.invite = null; paintInvite(); location.hash = code.toUpperCase();
        if (r.spectator) { toast(t('spectatorToast')); offerClaim(); }
      } catch (e) { console.error(e); toast(t('onlineOff')); }
    };
    $('btn-start-offline').onclick = () => {
      const n = myName() || (t('player') + ' 1');
      Net.createLocal(n); onRoomChange(Net.S.room, null);
    };
    $('btn-start-game').onclick = () => Net.startGame();
    $('btn-leave-waiting').onclick = () => confirmLeave('waiting');
    $('btn-leave-game').onclick = () => (U.replay ? exitReplay() : confirmLeave('game'));
    $('btn-replay-waiting').onclick = () => { const r = Net.S.room; if (r) startReplay(r); };
    $('spectator-badge').onclick = offerClaim; $('spectator-badge').style.cursor = 'pointer';
    $('rp-first').onclick = () => { rpPause(); rpGo(0, false); }; $('rp-prev').onclick = () => { rpPause(); rpGo(U.replay.idx - 1, false); };
    $('rp-play').onclick = rpToggle; $('rp-next').onclick = () => { rpPause(); rpGo(U.replay.idx + 1, true); };
    $('rp-last').onclick = () => { rpPause(); rpGo(1e9, false); }; $('rp-exit').onclick = exitReplay;
    $('rp-speed').onclick = () => { const rp = U.replay; rp.speed = rp.speed === 1 ? 2 : rp.speed === 2 ? 4 : 1; updateReplayBar(); };
    $('rp-slider').oninput = e => { const v = +e.target.value; rpPause(); rpGo(v, false); };    // read first: rpPause() re-syncs the slider
    $('btn-rules').onclick = () => { const r = Net.S.room; if (r) showRulesModal(r); };
    $('btn-roll').onclick = onRoll; $('die-btn').onclick = onRoll;
    $('room-code-display').onclick = () => { try { navigator.clipboard.writeText(inviteLink()); toast(t('copied')); } catch (e) {} };
    // Enter in the name / code box = press the main button of the open tab
    ['input-name', 'input-room-code'].forEach(id => $(id).addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const act = document.querySelector('.tab-panel.active .btn'); if (act) act.click();
    }));
    // someone pastes an invite link into a tab that is already open: only the #code changes, no reload
    window.addEventListener('hashchange', () => { const c = inviteCode(); if (c && U.screen === 'lobby' && !Net.S.mode) showInvite(c); });
    document.addEventListener('keydown', onKey);
  }
  function onRoomChangeRerender(room) {
    if (U.replay) { renderGame(U.replay.room); updateReplayBar(); return; }
    if (U.screen === 'waiting') renderWaiting(room);
    else if (U.screen === 'game') renderGame(room);
  }

  // ---- invite links: <page>#K7QXP (or ?room=K7QXP) -> the Join tab with the code already filled in ----
  const CODE_RE = /^[A-Za-z0-9]{5}$/;
  function inviteCode() {
    const h = decodeURIComponent(location.hash.replace('#', '')).trim();
    if (CODE_RE.test(h)) return h.toUpperCase();
    let q = ''; try { const sp = new URLSearchParams(location.search); q = (sp.get('room') || sp.get('code') || sp.get('join') || '').trim(); } catch (e) {}
    return CODE_RE.test(q) ? q.toUpperCase() : '';
  }
  const inviteLink = () => location.href.split('#')[0].split('?')[0] + '#' + (Net.S.code && Net.S.code !== 'LOCAL' ? Net.S.code : '');
  function paintInvite() {
    const n = $('invite-note'); if (!n) return;
    n.style.display = U.invite ? '' : 'none'; if (U.invite) n.textContent = t('inviteNote', U.invite);
  }
  function showInvite(code) {
    U.invite = code; $('input-room-code').value = code;
    document.querySelector('[data-tab=join]').click(); paintInvite();
    const nm = $('input-name'); (nm.value.trim() ? $('btn-join-room') : nm).focus();
  }
  async function init() {
    applyStaticText();
    try { $('input-name').value = localStorage.getItem('ludo_name') || ''; } catch (e) {}
    if (!Net.ONLINE_OK) $('online-off-note').style.display = '';
    Net.S.onChange = onRoomChange;
    wire();
    const code = inviteCode();
    // A link with a room code on a page that can reach Firebase may be a RELOAD of a game in progress: stay on the
    // spinner (the page starts on it) instead of flashing the lobby, and only fall back to the lobby when we are
    // sure there is nothing to go back to.
    const maybeBack = !!code && Net.ONLINE_OK;
    if (!maybeBack) showScreen('lobby');
    if (code) showInvite(code);                       // right away: never wait for the network to show the Join tab
    if (maybeBack) {
      if (Net.preload(code)) { rememberRoom(code); U.invite = null; paintInvite(); return; }     // board drawn from the last snapshot at once
      const lobbyLater = setTimeout(() => { if (U.screen === 'loading') showScreen('lobby'); }, 5000);
      try {
        const c = await Net.tryRejoin(code);           // already seated there -> straight back in
        if (c) { rememberRoom(c); U.invite = null; paintInvite(); }
        else showScreen('lobby');
      } catch (e) { console.error(e); clearTimeout(lobbyLater); showScreen('lobby'); }
    } else if (!code) refreshResume();
  }
  window.LudoUI = { U, init, driver, applyStaticText };   // exposed for tests / debugging
  init();
})();
