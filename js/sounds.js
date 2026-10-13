// sounds.js — same tiny sound manager as Boardwalk Night.
// Add a sound: drop the file in /sounds/, add one line below, call playSound('key').
// playSound() silently no-ops if a file is missing or autoplay is blocked.

const SOUND_FILES = {
  gameStart:  'sounds/game-start.mp3',
  gameOver:   'sounds/game-over.mp3',
  diceRoll:   'sounds/roll-dice.mp3',
  footstep:   'sounds/footstep.wav',
  leaveBase:  'sounds/card-gain.mp3',
  capture:    'sounds/bonk.mp3',
  home:       'sounds/land-on-go.mp3',
  endTurn:    'sounds/end-turn.mp3',
  pass:       'sounds/decline-buy.mp3',
  buttonHover:'sounds/button-hover.wav'
};

const _sounds = {};
for (const key in SOUND_FILES) {
  const audio = new Audio(SOUND_FILES[key]);
  audio.preload = 'auto';
  _sounds[key] = audio;
}

let soundEnabled = (function () {
  try { return localStorage.getItem('ludo_sound') !== 'off'; } catch (e) { return true; }
})();

function setSoundEnabled(on) {
  soundEnabled = on;
  try { localStorage.setItem('ludo_sound', on ? 'on' : 'off'); } catch (e) {}
}

function playSound(key) {
  if (!soundEnabled) return;
  const src = _sounds[key];
  if (!src) return;
  const inst = src.cloneNode();
  inst.volume = key === 'buttonHover' ? 0.25 : 0.8;
  inst.play().catch(() => {});
}
