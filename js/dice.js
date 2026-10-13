// dice.js — the die roller. Instead of Math.random()*6 it throws a virtual cube:
//   1. draw 4 independent standard-normal REAL numbers (Box-Muller on 53-bit uniform reals taken
//      from the browser's crypto generator) and normalise them -> a uniformly random 3D rotation
//      (unit quaternion) of the cube in the air;
//   2. rotate the world "up" vector into the cube's own frame (real-number rotation maths);
//   3. the face whose normal is closest to "up" is the one lying on top.
// Because the rotation is uniform over all orientations, every face has probability exactly 1/6
// (opposite faces sum to 7, like a real die). Works in the browser (window.Dice) and in Node.
(function (root) {
  'use strict';
  const cryptoObj = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto
    : (typeof require === 'function' ? (function () { try { return require('crypto').webcrypto; } catch (e) { return null; } })() : null);

  // Uniform real in [0, 1) with 53 random bits.
  function uniform() {
    if (!cryptoObj) return Math.random();
    const a = new Uint32Array(2); cryptoObj.getRandomValues(a);
    return ((a[0] >>> 5) * 67108864 + (a[1] >>> 6)) / 9007199254740992;
  }
  // Standard normal real (Box-Muller). 1-uniform() is in (0, 1] so log() is finite.
  function gaussian() {
    return Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
  }
  // Uniformly distributed random rotation as a unit quaternion [w, x, y, z].
  function randomRotation() {
    let w, x, y, z, n;
    do { w = gaussian(); x = gaussian(); y = gaussian(); z = gaussian(); n = Math.hypot(w, x, y, z); } while (!(n > 1e-9));
    return [w / n, x / n, y / n, z / n];
  }
  // Face pointing up for a cube rotated by quaternion q. Body-frame normals: +x=1 -x=6 +y=2 -y=5 +z=3 -z=4.
  function faceUp(q) {
    const [w, x, y, z] = q;
    // world up (0,0,1) expressed in the cube's frame = third row of the rotation matrix
    const bx = 2 * (x * z - w * y), by = 2 * (y * z + w * x), bz = 1 - 2 * (x * x + y * y);
    const ax = Math.abs(bx), ay = Math.abs(by), az = Math.abs(bz);
    if (ax >= ay && ax >= az) return bx > 0 ? 1 : 6;
    if (ay >= az) return by > 0 ? 2 : 5;
    return bz > 0 ? 3 : 4;
  }
  const roll = () => faceUp(randomRotation());

  const api = { roll, faceUp, randomRotation, uniform, gaussian };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Dice = api;
})(typeof window !== 'undefined' ? window : globalThis);
