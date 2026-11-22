// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by a pathfinding pilot, so the
// frame is what a short game really looks like and the same seed always
// stages the same frame. The pilot walks a breadth-first path over the tile
// grid, detours for loot when asked, and sneaks whenever an eye is on it.

import { STEP, TILE } from './config.js';
import { EVENT_BUSTED, EVENT_CLEAR, EVENT_JEWEL } from './world.js';
import { SCREEN_BUSTED, SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const key = (x, y) => `${x},${y}`;

/** A breadth-first path of tiles from one tile to another, or null. */
function findPath(walls, from, to) {
  const queue = [from];
  const prev = new Map([[key(from.x, from.y), null]]);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.x === to.x && cur.y === to.y) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift(node);
        node = prev.get(key(node.x, node.y));
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      const k = key(next.x, next.y);
      if (!walls.has(k) && !prev.has(k)) {
        prev.set(k, cur);
        queue.push(next);
      }
    }
  }
  return null;
}

/** Steer the thief along a path toward `target` for one step. */
function pilotInput(state, target) {
  const from = {
    x: Math.floor(state.player.x / TILE),
    y: Math.floor(state.player.y / TILE),
  };
  if (from.x === target.x && from.y === target.y) return { dx: 0, dy: 0, sneak: false };
  const path = findPath(state.floor.walls, from, target);
  if (!path || path.length < 2) return { dx: 0, dy: 0, sneak: false };
  const next = path[1];
  const cx = next.x * TILE + TILE / 2;
  const cy = next.y * TILE + TILE / 2;
  const vx = cx - state.player.x;
  const vy = cy - state.player.y;
  const m = Math.hypot(vx, vy) || 1;
  return { dx: vx / m, dy: vy / m, sneak: state.seenNow || state.alarm > 30 };
}

/** The two untaken loot tiles nearest the thief, nearest first. */
function nearestLoot(state, count) {
  return state.floor.loot
    .filter((item) => !item.taken)
    .map((item) => ({
      item,
      d: Math.hypot(item.x - state.player.x / TILE, item.y - state.player.y / TILE),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ item }) => item);
}

/** Run the pilot through a list of targets; returns the last step's events. */
function runRoute(world, targets, maxSeconds) {
  const state = world.state;
  let events = 0;
  let targetIndex = 0;
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    while (targetIndex < targets.length) {
      const target = targets[targetIndex];
      const onTile = Math.floor(state.player.x / TILE) === target.x
        && Math.floor(state.player.y / TILE) === target.y;
      if (!onTile) break;
      targetIndex += 1;
    }
    if (targetIndex >= targets.length) break;
    events = world.step(STEP, pilotInput(state, targets[targetIndex]));
    if (events & (EVENT_CLEAR | EVENT_BUSTED)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'play') {
    // A heist in progress: two grabs, the jewel, then half the run for the van.
    const detours = nearestLoot(state, 2);
    runRoute(world, [...detours, state.floor.jewel], 40);
    runRoute(world, [state.floor.exit], 5);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    // The whole first floor, played straight: jewel, then the van.
    const events = runRoute(world, [state.floor.jewel, state.floor.exit], 90);
    if (events & EVENT_CLEAR) return { screen: SCREEN_CLEAR, best: state.banked };
    if (events & EVENT_BUSTED) return { screen: SCREEN_BUSTED, best: 0 };
    return { screen: SCREEN_PLAY, best: state.banked };
  }
  // start: the bank idles behind the title for a few seconds.
  for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, { dx: 0, dy: 0, sneak: false });
  return { screen: SCREEN_TITLE, best: 0 };
}
