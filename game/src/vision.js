// Eyes: how guards and cameras see. Two questions live here. `sees` asks
// whether one observer's cone reaches a point with no wall in the way, and
// `conePolygon` traces the cone's lit shape for the renderer, casting a fan
// of rays that stop at the first wall each one meets, so a cone spills
// through doorways and stops at corners the way a real gaze does.

import { TILE } from './config.js';

/** The tile key vision shares with the world's wall set. */
export const tileKey = (x, y) => `${x},${y}`;

/** Whether the tile at pixel position (px, py) is a wall. */
function wallAt(walls, px, py) {
  return walls.has(tileKey(Math.floor(px / TILE), Math.floor(py / TILE)));
}

/**
 * March from (x, y) along `angle` until a wall or `range` stops the ray;
 * returns the distance travelled. The march starts a little past the origin
 * so an eye mounted on a wall tile is not blinded by its own tile.
 */
export function rayDistance(walls, x, y, angle, range) {
  const step = 4;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let d = TILE * 0.55;
  while (d < range) {
    if (wallAt(walls, x + dx * d, y + dy * d)) return d;
    d += step;
  }
  return range;
}

/** The shortest angle between two headings, in [0, PI]. */
export function angleBetween(a, b) {
  let diff = (a - b) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

/**
 * Whether an observer at (x, y) facing `angle`, with the given cone range
 * and half-angle, can see the point (tx, ty): inside the range, inside the
 * cone, and a clear ray between. The clear-ray check reuses rayDistance:
 * the wall that stops the ray must be no closer than the target.
 */
export function sees(walls, x, y, angle, range, halfAngle, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 24 && angleBetween(Math.atan2(dy, dx), angle) > halfAngle) return false;
  return rayDistance(walls, x, y, Math.atan2(dy, dx), dist) >= dist - 1;
}

/**
 * The lit polygon of a cone, for the renderer: the observer's position plus
 * one point per ray across the cone, each stopped by its wall. 26 rays is
 * smooth enough at this scale and cheap enough to cast every frame.
 */
export function conePolygon(walls, x, y, angle, range, halfAngle) {
  const rays = 26;
  const points = [{ x, y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = rayDistance(walls, x, y, a, range);
    points.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return points;
}
