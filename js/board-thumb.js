// board-thumb.js — tiny SVG previews of the two boards for the waiting room.
// Drawn straight from the engine's geometry (Ludo.BOARDS), so a preview can never drift from the
// real board. Works in the browser (window.BoardThumb) and in Node (for tests / PNG export).
(function (root) {
  'use strict';
  const BASE_ORG = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
  const ARROW = {            // little triangle on a start tile, pointing the way the pawn leaves
    red:    (x, y) => `${x + .22},${y + .22} ${x + .22},${y + .78} ${x + .8},${y + .5}`,
    green:  (x, y) => `${x + .22},${y + .22} ${x + .78},${y + .22} ${x + .5},${y + .8}`,
    yellow: (x, y) => `${x + .78},${y + .22} ${x + .78},${y + .78} ${x + .2},${y + .5}`,
    blue:   (x, y) => `${x + .22},${y + .78} ${x + .78},${y + .78} ${x + .5},${y + .2}`
  };

  function svg(boardId, Ludo, px, paletteId) {
    const L = Ludo || root.Ludo, HEX = (L.PALETTES[paletteId] || L.PALETTES[L.DEFAULT_PALETTE]).hex, B = L.BOARDS[boardId] || L.BOARDS[L.DEFAULT_BOARD], horse = B.id === 'horse';
    const o = [];
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15"${px ? ` width="${px}" height="${px}"` : ''} role="img" aria-hidden="true" class="thumb-${B.id}">`);
    o.push('<rect width="15" height="15" rx=".9" fill="#f7f3e6"/>');
    // bases
    L.COLORS.forEach(c => {
      const [x, y] = BASE_ORG[c];
      o.push(`<rect x="${x + .1}" y="${y + .1}" width="5.8" height="5.8" rx=".5" fill="${HEX[c]}"/>`);
      o.push(`<rect x="${x + .85}" y="${y + .85}" width="4.3" height="4.3" rx=".35" fill="#fff" fill-opacity=".8"/>`);
      [[2, 2], [4, 2], [2, 4], [4, 4]].forEach(([dx, dy]) => o.push(`<circle cx="${x + dx + .5 - .5}" cy="${y + dy + .5 - .5}" r=".55" fill="${HEX[c]}" fill-opacity=".55"/>`));
    });
    // track
    B.TRACK_XY.forEach(([x, y], i) => {
      const owner = L.COLORS.find(c => B.START[c] === i);
      o.push(`<rect x="${x + .04}" y="${y + .04}" width=".92" height=".92" fill="${owner ? HEX[owner] : '#fffaf0'}" stroke="#d9ccae" stroke-width=".07"/>`);
      if (owner) o.push(`<polygon points="${ARROW[owner](x, y)}" fill="#fff" fill-opacity=".9"/>`);
      else if (B.SAFE.has(i)) o.push(`<circle cx="${x + .5}" cy="${y + .5}" r=".16" fill="#d4a017"/>`);
    });
    // home lanes
    L.COLORS.forEach(c => B.LANE_XY[c].forEach(([x, y]) =>
      o.push(`<rect x="${x + .06}" y="${y + .06}" width=".88" height=".88" fill="${HEX[c]}" fill-opacity="${horse ? .55 : .95}"/>`)));
    // centre pinwheel
    const C = B.CENTER, x0 = C.x, y0 = C.y, x1 = C.x + C.w, y1 = C.y + C.h, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    o.push(`<polygon points="${x0},${y0} ${x1},${y0} ${cx},${cy}" fill="${HEX.green}"/>`);
    o.push(`<polygon points="${x1},${y0} ${x1},${y1} ${cx},${cy}" fill="${HEX.yellow}"/>`);
    o.push(`<polygon points="${x1},${y1} ${x0},${y1} ${cx},${cy}" fill="${HEX.blue}"/>`);
    o.push(`<polygon points="${x0},${y1} ${x0},${y0} ${cx},${cy}" fill="${HEX.red}"/>`);
    o.push('</svg>');
    return o.join('');
  }

  const api = { svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BoardThumb = api;
})(typeof window !== 'undefined' ? window : globalThis);
