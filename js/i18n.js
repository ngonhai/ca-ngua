// i18n.js — all UI text. Vietnamese (default, like Boardwalk Night) + English.
//
// ADD A LANGUAGE: copy the whole `en: { ... }` block below, rename the key to the language code
// (e.g. `ja`), translate the values, and set `meta.name` (shown in the language picker).
// That's it — the picker, saving the choice and every screen pick it up automatically.
//   * Keep every key (see the console warning listing anything you missed). A missing key just
//     falls back to English, so a half-finished language still works.
//   * Values that are functions (like `turnOf: n => ...`) receive the arguments in the same order
//     as the English version; `log.*` entries too.
//   * meta.htmlLang (optional) = value for <html lang>; meta.dir = 'rtl' for right-to-left scripts.
//
// t('key.path', ...args) looks the text up. Values may be strings or functions of the args.

const I18N = {
  vi: {
    meta: { name: 'Tiếng Việt', htmlLang: 'vi' },
    title: 'Cờ Cá Ngựa',
    subtitle: 'Đá qua đá lại — mới toại lòng nhau',
    yourName: 'Tên cậu là gì',
    namePh: 'e.g. Sơn Tùng MVP',
    tabCreate: 'Tạo Chuồng', tabJoin: 'Tham Gia', tabOffline: 'Chơi Offline',
    createRoom: 'Tạo Chuồng', joinRoom: 'Tham Gia', roomCode: 'Code Chuồng', codePh: 'e.g. K7XPS',
    offlineHint: 'Chơi trên cùng một máy — Nhiều người quây quần bên nhau hoặc đấu với bot — Không cần mạng.',
    startOffline: 'Chơi Offline',
    onlineOff: 'Không kết nối được Server — chơi offline đi.',
    roomCodeShare: 'Code Chuồng — chia sẻ cho người khác',
    offlineRoom: 'Chuồng Offline',
    seats: 'Chọn Màu', empty: 'Trống', host: 'Chủ chuồng', bot: 'AI', you: 'Cậu',
    sit: 'Đổi Chỗ', addBot: '+ Bot', addHuman: '+ Người', remove: 'Cook', kick: 'Kick',
    leaveTitle: 'Rời Game...?', leaveStay: 'Ở lại', leaveGo: 'Rời đi',
    leaveWaitingBody: 'Có chắc sẽ rời khỏi chuồng này?',
    leaveGameOnlineBody: 'Bạn sẽ thoát khỏi ván đang chơi. Bot sẽ thay chỗ.',
    leaveGameLocalBody: 'Ván Offline sẽ không được lưu lại — Hoặc 20k/1 lần lưu game.',
    houseRules: 'Luật Trực Nội', hostOnly: 'Chỉ chủ chuồng mới đổi được luật.',
    start: 'Bắt Đầu', waitHost: 'Chờ chủ chuồng Bắt Đầu...', needTwo: 'Cần ít nhất 2 Người/Bot.',
    leave: 'Rời', rules: 'Luật', sound: 'Thanh âm', copied: 'Đã copy link chứa code',
    colors: { red: 'Đỏ', green: 'Xanh Lá', yellow: 'Vàng', blue: 'Xanh Dương' },
    player: 'Người chơi',
    yourTurn: 'Tới lượt bạn!', turnOf: n => `Lượt của ${n}`, rollBtn: 'Đổ xúc xắc', rolling: 'Đang đổ…',
    pickPawn: 'Chọn ngựa để đi', losePick: 'Chọn ngựa để mất', losePickShort: n => `đổ ${n} lần [6] — chọn một quân để mất!`, waiting: 'Chờ…', spectating: 'Đang xem 👀 ', tries: n => `Còn ${n} lần đổ`,
    overridden: p => `Không có tác dụng khi “${p}” đang bật`,
    finishedCount: (a, b) => `${a}/${b} đã về chuồng`,
    offline: 'Mất kết nối', autoplay: 'Một lốp bot sẽ chơi thay',
    log: {
      roll: (n, d) => `${n} đổ ra ${d}`,
      leave: n => `${n} xuất ngựa`,
      capture: (n, o) => `${n} đá văng ngựa của ${o}`,
      home: n => `${n} đưa một ngựa về đích 🏁`,
      pass: n => `${n} không đi được, bỏ qua lượt`,
      sixes: n => `${n} code [6] liên tiếp quá nhiều lần — mất lượt!`,
      sixAgain: (n, d) => `${n} đổ [6] lần thứ ${d} liên tiếp — xóc lại!`,
      sixPen: (n, d) => `${n} đổ [6] lần thứ ${d} liên tiếp — phải mất một ngựa! ❌`,
      sixLose: n => `${n} mất một ngựa, quay về chuồng ❌`,
      sixNone: (n, d) => `${n} đổ [6] lần thứ ${d} liên tiếp nhưng không có quân nào để mất — xóc lại`,
      sixStuck: n => `${n} đổ [6] nhưng không đi được — vẫn được đổ lại`,
      extra: n => `${n} được thêm lượt`,
      rank: (n, d) => `${n} hoàn thành — hạng ${d} 🏆`
    },
    winTitle: n => `${n} chiến thắng!`, winFinal: 'Bảng xếp hạng', backToLobby: 'Về Lobby', playAgainHint: 'Chờ host bắt đầu ván mới…',
    place: n => `Hạng ${n} nếu ludo có hàng A,B`,
    kicked: 'Bạn được mời ra khỏi chuồng với 2 lí do', noRoom: 'Không có chuồng như vậy nhé!', roomFull: 'Chuồng đã đủ ngựa',
    spectatorToast: 'Game đã bắt đầu — cậu vào xem thôi nhé', nameNeeded: 'Nhập tên đã nào', inviteNote: c => `Cậu được mời vào chuồng ${c} — nhập tên rồi bấm Tham Gia nhé!`,
    on: 'Bật', off: 'Tắt',
    colors2: { red: 'Xanh Ngọc', green: 'Vàng', yellow: 'Xanh Chanh', blue: 'Đỏ Cam' },
    palettes: { classic: ['Mặc định', 'Đỏ · Xanh lá · Vàng · Xanh dương'], picture: ['Đổi thứ tự màu', 'Ngọc · Vàng · Chanh · Đỏ cam'] },
    lvl: { easy: 'Tuất', normal: 'Thường', hard: '10Khó' }, lvlTip: 'Đổi độ khó của bot',
    resumeTitle: 'Ván đang dở', resumeBody: (code, st) => `Bạn vẫn còn slot trong chuồng ${code} (${st === 'lobby' ? 'phòng chờ' : 'đang chơi'}).`, resumeBtn: 'Cốc Cốc', resumeGone: 'Chuồng này không còn nữa.',
    claimTitle: 'Vào lại slot cũ', claimBody: 'Chọn ghế của cậu — người chơi đã rời ván:', claimWatch: 'Chỉ xem', claimedToast: 'Đã vào lại slot', claimFail: 'Slot này vừa có người khác nhận.',
    replayBtn: 'Xem lại ván', replayLast: 'Xem lại ván trước', replayBadge: 'Xem lại', replayExit: 'Thoát', replayStep: (i, n) => `Nước ${i} / ${n}`, replaySpeed: 'Tốc độ',
    defaultTag: 'Mặc định',
    boards: {
      horse: ['Cờ cá ngựa Standard', '56 ô, đường về đích 6 bậc. Hơi khác so với Ludo chuẩn'],
      classic: ['Ludo chuẩn', '52 ô, đường về đích 5 bậc. Hơi khác so với Cờ cá ngựa Standard']
    },
    set: {
      noJump: ['Không được nhảy qua ngựa (quan trọng)', 'Bật: không được di qua bất kỳ quân ngựa nào và không được đứng chung ô — Luật này đè lên Rào chắn. Tắt đá Ngựa và Ô an toàn (những luật vốn cho phép đứng chung ô).'],
      board: ['Bàn cờ', 'Chọn kiểu bàn cờ cho ván này.'],
      palette: ['Bảng màu', 'Được cái khác màu sắc.'],
      capture: ['Đá ngựa', 'Bật: đáp xuống ô có ngựa đối thủ thì ngựa đó bị đá về chuồng. Tắt: không ai bị đá (Lưu ý: chỉ được đứng chung ô khi luật “Không được nhảy qua ngựa đang tắt).'],
      safeTiles: ['Ô an toàn', 'Bật: đáp trên ô ★/ ô xuất phát của bản thân không ai bị đá. Tắt: đá được ở mọi ô.'],
      needSix: ['Cần đổ [6] để xuất ngựa', 'Bật: phải đổ [6] mới ra khỏi chuồng. Tắt: số nào cũng xuất chuồng được.'],
      triesWhenStuck: ['Được đổ 3 lần khi chưa có quân', 'Chưa có quân nào ngoài chuồng thì được đổ tối đa 3 lần để tìm số [6].'],
      sixExtra: ['Đổ [6] được đổ tiếp', 'Đổ ra [6] thì được thêm một lượt đổ.'],
      sixPenalty: ['Phạt khi nhiều [6] liên tiếp', '(Liên quan đến cái trên): 3 lần 6 liên tiếp: xóc lại. 4 lần: mất 1 ngựa, 5 lần: mất 2, 6 lần: xóc lại, 7 lần: mất 3, 8 lần: mất 4'],
      maxSixes: ['Số lần [6] liên tiếp bị mất lượt', 'Đổ [6] liên tiếp đủ số lần này thì mất lượt, không được đi (0 = không giới hạn).'],
      captureExtra: ['Đá ngựa được đổ tiếp', 'Đá được ngựa đối thủ thì được thêm một lượt đổ.'],
      homeExtra: ['Về đích được đổ tiếp', 'Đưa một ngựa về chuồng thì được thêm một lượt đổ.'],
      exactFinish: ['Đổ đúng số để về đích', 'Bật: phải đổ đúng số bước còn lại. Tắt: đổ dư thì nẩy lùi lại.'],
      blockade: ['Rào chắn', 'Bật: hai ngựa cùng team đứng chung ô thì tạo thành rào, quân khác không đi qua và không đáp vào được.'],
      homeGate: ['Phải đáp đúng cổng trước khi vào chuồng', 'Bật: không được đi thẳng vào chuồng. Phải đáp đúng ô trắng cuối đường (ô ngay trước đường vào chuồng), rồi lượt sau mới bước vào chuồng.'],
      pawns: ['Số ngựa mỗi người', 'Từ 1 đến 4 ngựa.'],
      finishMode: ['Kết thúc ván', 'Người đầu tiên về đích thắng, hoặc chơi tiếp để xếp hạng hết mọi người.'],
      autoMove: ['Tự đi khi chỉ có 1 nước', 'Chỉ có một quân đi được thì game sẽ tự đi luôn, đỡ phải bấm.']
    },
    choice: { first: 'Kết thúc ván khi có người thắng đầu tiên', ranking: 'Chơi tiếp để xếp hạng' }
  },


  en: {
    meta: { name: 'English', htmlLang: 'en' },
    title: 'Ludo',
    subtitle: 'Knock \'em out — Shock \'em loud.',
    yourName: 'Your name',
    namePh: 'e.g. Nguyễn Văn Mười',
    tabCreate: 'Create Barn', tabJoin: 'Join Barn', tabOffline: 'Play Offline',
    createRoom: 'Create Barn', joinRoom: 'Join Barn', roomCode: 'Barn code', codePh: 'e.g. K7XPS',
    offlineHint: 'Play on one device: take turns with your true friends or face bots. No internet needed.',
    startOffline: 'Play Offline',
    onlineOff: "Couldn't reach Firebase — offline play instead.",
    roomCodeShare: 'Barn Code — share it with people',
    offlineRoom: 'Offline barn',
    seats: 'Seats', empty: 'Empty', host: 'Host', bot: 'Bot', you: 'You',
    sit: 'Sit here', addBot: '+ Bot', addHuman: '+ Human', remove: 'Remove', kick: 'Kick',
    leaveTitle: 'Leave too early?', leaveStay: 'Stay', leaveGo: 'Leave',
    leaveWaitingBody: 'You will leave this waiting room immediately.',
    leaveGameOnlineBody: 'You will leave the game behind. A bot will play for you.',
    leaveGameLocalBody: 'This offline game will be abandoned and not saved, unfortunately!!',
    houseRules: 'House Rules', hostOnly: 'Only the host can change the rules.',
    start: 'Start Game', waitHost: 'Waiting for the host to Start Game…', needTwo: 'Need at least 2 intelligences',
    leave: 'Leave', rules: 'Rules', sound: 'Sound', copied: 'Link code copied',
    colors: { red: 'Rose', green: 'Mint', yellow: 'Daisy', blue: 'Iris' },
    player: 'Player',
    yourTurn: "It's your turn!", turnOf: n => `${n}'s turn`, rollBtn: 'Roll the die', rolling: 'Rolling…',
    pickPawn: 'Pick a pawn to move', losePick: 'Pick a pawn to lose', losePickShort: n => `${n} sixes — pick a pawn to lose!`, waiting: 'Waiting…', spectating: 'Spectating 👀', tries: n => `${n} attempts left`,
    overridden: p => `No effect while “${p}” is on`,
    finishedCount: (a, b) => `${a}/${b} home`,
    offline: 'disconnected', autoplay: 'bot is playing',
    log: {
      roll: (n, d) => `${n} rolled ${d}`,
      leave: n => `${n} brought a pawn out`,
      capture: (n, o) => `${n} knocked out a pawn of ${o}`,
      home: n => `${n} got a pawn home 🏁`,
      pass: n => `${n} has no move — turn passed`,
      sixes: n => `${n} cheated too many [6] in a row — turn lost!`,
      sixAgain: (n, d) => `${n} rolled a ${d}th six in a row — roll again!`,
      sixPen: (n, d) => `${n} rolled a ${d}th six in a row — a pawn is lost! ❌`,
      sixLose: n => `${n} loses a pawn, back to their stable ❌`,
      sixNone: (n, d) => `${n} rolled a ${d}th six in a row but has no pawn to lose — roll again`,
      sixStuck: n => `${n} rolled a 6 but can't move — still rolls again`,
      extra: n => `${n} rolls again`,
      rank: (n, d) => `${n} finished — ranked ${d} 🏆`
    },
    winTitle: n => `${n} cooked!`, winFinal: 'Final standings', backToLobby: 'Back to lobby', playAgainHint: 'Waiting for the host to start a new game…',
    place: n => `Place ${n}`,
    kicked: 'You were bye-byed from the barn', noRoom: 'No such barn!', roomFull: 'The barn is full',
    spectatorToast: 'Game already started — you are watching', nameNeeded: 'Enter a name first', inviteNote: c => `You're invited to barn ${c} — enter your name and Join!`,
    on: 'On', off: 'Off',
    colors2: { red: 'lapis', green: 'Sapphire', yellow: 'Emerald', blue: 'Ruby' },
    palettes: { classic: ['Flower', 'Rose · Mint · Daisy · Iris'], picture: ['Gems', 'Lapis · Shappire · Emerald · Ruby'] },
    lvl: { easy: 'Easy', normal: 'Normal', hard: 'Smart' }, lvlTip: 'Change bot difficulty',
    resumeTitle: 'Game in progress', resumeBody: (code, st) => `You still hold a seat in barn ${code} (${st === 'lobby' ? 'waiting room' : 'playing'}).`, resumeBtn: 'Rejoin', resumeGone: 'That barn no longer exists.',
    claimTitle: 'Take your old seat back', claimBody: 'Pick your seat — the prev player has left the game:', claimWatch: 'Just watch', claimedToast: 'Welcome back!', claimFail: 'Someone just took that seat.',
    replayBtn: 'Watch replay', replayLast: 'Replay last game', replayBadge: 'Replay', replayExit: 'Quit', replayStep: (i, n) => `Move ${i} / ${n}`, replaySpeed: 'Speed',
    defaultTag: 'Default',
    boards: {
      horse: ['Cờ cá ngựa Standard', '56 tiles, 6-step home lane. Slightly different from Ludo chuẩn'],
      classic: ['Ludo chuẩn', '52 tiles, 5-tile home lane. Slightly different from Cờ cá ngựa Standard']
    },
    set: {
      noJump: ['No jumping over pawns (parent rule)', 'On: you can’t jump over any pawn (anyone’s) and can’t share a tile — you may only stop behind it or land exactly on it to kick it. Overrides Blockades, “capture off” and Safe tiles (the rules that would let pawns share a tile).'],
      board: ['Board', 'Pick the board for this game. The rules below apply to both boards.'],
      palette: ['Colour palette', 'Only changes how the seats are coloured; the rules stay the same.'],
      capture: ['Capture pawns', 'On: landing on an opponent sends it back to base. Off: nobody is knocked out (pawns may share a tile only while “No jumping over pawns” is off).'],
      safeTiles: ['Safe tiles', 'On: ★ tiles protect everyone; a start tile protects only its owner (an enemy standing on your start tile is kicked when you leave base). Off: capture anywhere.'],
      needSix: ['Need a [6] to leave base', 'On: you must roll a [6] to bring a pawn out. Off: any number works.'],
      triesWhenStuck: ['3 tries with no pawn out', 'With no pawn on the board you get up to 3 rolls to find a [6].'],
      sixExtra: ['Roll again on a [6]', 'Rolling a [6] gives you another roll.'],
      sixPenalty: ['Sixes in a row (house rule)', '3 sixes in a row: roll again. 4th: lose 1 pawn, 5th: lose 2, 6th: roll again, 7th: lose 3, 8th: lose 4 (each penalty six costs one more pawn, sent back to base). With several pawns you choose which one; with only one (or none) there is nothing to choose.'],
      maxSixes: ['Sixes in a row that forfeit', 'Rolling this many [6] in a row loses the turn (0 = unlimited).'],
      captureExtra: ['Roll again after capture', 'Knocking out an opponent gives another roll.'],
      homeExtra: ['Roll again when a pawn gets home', 'Getting a pawn home gives another roll.'],
      exactFinish: ['Exact roll to finish', 'On: you need the exact number to get home. Off: overshooting bounces you back.'],
      blockade: ['Blockades', 'On: two same-coloured pawns on a tile form a wall — others can’t pass or land there.'],
      homeGate: ['Gate tile before the home lane', 'On: you can’t run straight into the home lane. First land exactly on the last white tile (the one next to the lane entrance), then step in on a later turn.'],
      pawns: ['Pawns per player', '1 to 4 pawns (fewer = shorter game).'],
      finishMode: ['Game end', 'First player home wins, or keep playing to rank everyone.'],
      autoMove: ['Auto-move when only one move', 'If just one pawn can move, it moves automatically.']
    },
    choice: { first: 'First home wins', ranking: 'Play on for rankings' }
  }
};


// ---------------------------------------------------------------------------------------------
// Language engine — nothing below needs editing when you add a language.
// ---------------------------------------------------------------------------------------------
const DEFAULT_LANG = 'vi';    // used on a first visit
const FALLBACK_LANG = 'en';   // used for any key the current language doesn't translate

const hasLang = c => !!c && Object.prototype.hasOwnProperty.call(I18N, c);
const availableLangs = () => Object.keys(I18N);
const langName = c => (hasLang(c) && I18N[c].meta && I18N[c].meta.name) || String(c).toUpperCase();

let LANG = (function () {
  try { const s = localStorage.getItem('ludo_lang'); if (hasLang(s)) return s; } catch (e) {}
  return hasLang(DEFAULT_LANG) ? DEFAULT_LANG : availableLangs()[0];
})();
function setLang(l) {
  if (!hasLang(l)) return;
  LANG = l;
  try { localStorage.setItem('ludo_lang', l); } catch (e) {}
}

function _lookup(code, parts) {
  let v = hasLang(code) ? I18N[code] : null;
  for (const p of parts) v = v == null ? v : v[p];
  return v;
}
function t(key, ...args) {
  const parts = key.split('.');
  let v = _lookup(LANG, parts);
  if (v == null) v = _lookup(FALLBACK_LANG, parts);
  if (v == null) v = _lookup(DEFAULT_LANG, parts);
  if (v == null) return key;
  return typeof v === 'function' ? v(...args) : v;
}

// Dev helper: warn in the console about keys a language hasn't translated yet.
(function checkI18n() {
  const flat = (o, pre = '') => Object.keys(o || {}).flatMap(k => {
    if (!pre && k === 'meta') return [];
    const v = o[k], path = pre + k;
    return v && typeof v === 'object' && !Array.isArray(v) ? flat(v, path + '.') : [path];
  });
  if (!hasLang(FALLBACK_LANG)) return;
  const ref = flat(I18N[FALLBACK_LANG]);
  availableLangs().forEach(code => {
    if (code === FALLBACK_LANG) return;
    const have = new Set(flat(I18N[code]));
    const missing = ref.filter(k => !have.has(k));
    if (missing.length) console.warn(`[i18n] "${code}" is missing ${missing.length} key(s) (English is shown instead):`, missing);
  });
})();
