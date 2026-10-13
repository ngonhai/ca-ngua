# Cờ Cá Ngựa (Ludo)

Browser Ludo built in the same style/stack as Boardwalk Night: plain HTML/CSS/JS, optional
Firebase Realtime Database for online rooms, free static hosting (GitHub Pages).
Vietnamese by default, English via the 🌐 button.

## Play modes
- **Create / Join room** – online, up to 4 players (+ bots). Share the 5-letter code, or click it to copy an invite link (`<page>#CODE`, `?room=CODE` also works): whoever opens it lands on the Join tab with the code filled in and only has to type a name (Enter joins). Someone already seated in that room is taken straight back in.
- **Play Offline** – one device: hot-seat with friends and/or bots. Needs no network or Firebase.
- Bots are driven by the host; if a human disconnects for 20 s a bot plays for them until they return.

## Boards (host picks one in the waiting room, with a live preview of each)
| Board | Layout |
|---|---|
| **Cờ cá ngựa** (default) | 56-tile loop that also runs through the 4 corner tiles; pawns leave on the **first** tile of their arm (the arrow tile); 6-tile home lane numbered 1–6; one-tile centre |
| Ludo chuẩn (`classic`) | The original 52-tile board; pawns leave on the 2nd tile of the arm; 5-tile home lane |

All rules below work on both boards. Games saved before boards existed (no `settings.board`) keep playing on the classic board.

## Host rule toggles (waiting room)
| Rule | Default |
|---|---|
| **Capture pawns** (landing on an opponent sends it home) | on |
| Safe tiles (★ protects everyone; a start tile protects only its owner — an enemy sitting on your start tile is kicked when you leave base) | on |
| Need a 6 to leave base / 3 tries when no pawn is out | on / on |
| Roll again on 6 / after capture / when a pawn gets home | on / on / on |
| **Six penalty (house rule)** — 3 sixes in a row: roll again; 4th: lose 1 pawn; 5th: lose 2; 6th: roll again; 7th: lose 3; 8th: lose 4 (every six that isn't a multiple of 3, from the 4th, costs one more pawn, sent back to base). Any pawn on the board that hasn't finished can be lost (track or home lane). With several pawns the player picks (they turn danger-red, hover shows an ✕); with one — or several on the same tile/progress — it's automatic; with none nothing is lost. | on |
| N sixes in a row lose the turn (0 = unlimited) — replaced by the six penalty while that is on | 3 |
| A 6 that can't be played still earns the extra roll (with "Roll again on a 6" on) | – |
| Exact roll to finish (off = bounce back) | on |
| Blockades (2 same-colour pawns form a wall) — no effect while the parent rule is on | off |
| **No jumping over pawns — parent rule** (can't pass any pawn and can't share a tile: you may only stop behind a pawn or land on it to kick it; overrides Blockades, "capture off" and Safe tiles) | on |
| **Gate tile before the home lane** (land exactly on the last white tile next to the lane, then step in on a later turn) | on |
| Pawns per player (1–4) | 4 |
| Game end: first home wins, or play on for rankings | first |
| Auto-move when only one move is possible | on |

## Setup
Same Firebase project as Boardwalk Night (`js/firebase-config.js` is copied from it). Ludo rooms are
stored at `rooms/ludo_<CODE>`, which is already covered by the existing rules
(`rooms/$roomId` read/write), so **no rule changes are needed**. Push the folder to GitHub Pages
like the original.

## Adding a language
Copy the `en: { ... }` block in `js/i18n.js`, rename it to the language code (e.g. `ja`), translate it and set
`meta.name`. Nothing else: the language picker, the saved choice and all screens pick it up automatically.
Missing keys fall back to English (the console lists them). Use `meta.dir: 'rtl'` for right-to-left scripts.
The bundled web fonts are Latin; other scripts use the system font.

## Files
- `js/ludo-engine.js` – pure rules (no DOM/Firebase); unit-tested in `tests/` (`node tests/engine.test.js`, `engine_nojump.test.js`, `horse_board.test.js`, `six_penalty.test.js`).
  Board geometry lives in `BOARDS` (`horse`, `classic`): `TRACK_XY`, `LANE_XY`, `START`, `LAST_TRACK`, `FINISH`, `CENTER`.
- `js/board-thumb.js` – the two small board previews (SVG drawn from `BOARDS`, so they always match the real boards).
- `js/ludo-net.js` – room store: Firebase (transactions) or in-memory local mode.
- `js/ludo-ui.js` – screens, board, animations, bot driver. `js/i18n.js` – vi/en strings.
- Add a board: add an entry to `BOARDS` + `BOARD_IDS` (engine), a `boards.<id>` string in `i18n.js` and a `.board-<id>` style in `style.css`.
- Add a rule: add a key to `DEFAULT_SETTINGS` + `SETTINGS_META` in the engine, use it in `evalMove`/`move`,
  and add its label to `i18n.js` (`set.<key>`).


## Extras (v5)
- **Rejoin**: the lobby shows a "Vào lại" card for the room you still hold a seat in (remembered per browser). A spectator can also take over a seat whose player left (`Net.claimSeat`, tap the "Đang xem" badge).
- **Footprints**: faint dots are dropped on every tile *while* the pawn walks, plus a dashed ring where it left and a soft glow where it landed (mover's colour). The footprints of the **last 2 moves** of the game stay on the board (the older one fainter; `g.prevMove` keeps it across reloads). A ring pulses on a capture.
- **Keyboard** (deliberately not advertised in the UI): Space/Enter rolls, then arrows cycle the movable tiles and Space/Enter confirms; keys 1–4 pick that pawn directly. In a replay: Space = play/pause, ←/→ step, Home/End jump. **Haptics** (`navigator.vibrate`) follow the 🔊 switch and only fire for your own pawns (roll, 6, capture, home, win).
- **Bot levels** per bot seat (tap the chip in the waiting room): `easy` (30% random, noisy, careless), `normal`, `hard` (looks one move ahead: the best capture the next player can make over the 6 dice values, plus the shots it creates). Measured in `tests/bots_replay.test.js` (2-player duels): hard ≈ 54% vs normal, normal ≈ 73% vs easy.
- **Replay**: each game stores its start and every roll/move as a short string (`room.replay.ev`, digits = rolls, letters = pawn moves); `Ludo.replayStates` rebuilds every position. Open it from the win dialog or from the waiting room; play/pause, step, scrub, 1×/2×/4×.
- **Palettes**: room setting `palette` — `classic` or `picture` (cyan / yellow / lime / orange-red like the reference board). Colours only; seat keys and rules are unchanged. Bots are named "<colour> Bot" at display time so they follow the palette.

## Six penalty internals
- Engine: `roll()` counts `g.sixes`; on a penalty six it sets `phase: 'penalty'` (several candidates) and `Ludo.losePawn(g, i)` resolves it. `lossSeq`/`lastLoss` drive the UI animation; `botLose` gives up the least advanced pawn.
- Net: `Net.doLose(v, pawn)`. Replay: the chosen pawn is a letter after the roll digit, like a move (`replayStates` flags the step `lost`).

## Reload without a flash
- A link with a room code (`#CODE`) on a page that can reach Firebase starts on the spinner, never on the lobby. `Net.preload(code)` redraws the board at once from the last room snapshot kept in `localStorage` (`ludo_snap`: my own seat only, < 6 h old, wiped on leaving), then the live Firebase state takes over a moment later. No snapshot -> spinner until `tryRejoin` answers (lobby after 5 s at most).
- Offline (single-device) games live in memory only, so reloading them still starts over.
