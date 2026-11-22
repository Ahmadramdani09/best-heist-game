// The three floors of the Meridian Bank, drawn as text maps plus the patrol
// and camera placements that bring each one to life.
//
// Map letters: # wall, . marble, , carpet, s shadow carpet (an eye fills
// slower while the thief stands on it), D a doorway, P the thief's entry,
// E the getaway van, V the Crown Jewel, and the loot letters of LOOT_VALUES
// (c cash, p painting, g gem, n necklace). Guard patrols are waypoint loops
// in tile coordinates; cameras sit on wall tiles and sweep around the angle
// they are given (radians, 0 is east, positive turns clockwise on screen).

import { LOOT_VALUES } from './config.js';

const FLOORS = [
  {
    name: 'Floor 1 — The Lobby',
    brief: 'Warm-up: two guards, sleepy cameras, one very exposed vault.',
    parSeconds: 75,
    map: [
      '##########################',
      '#.........#......#.......#',
      '#..c......#..p...#...g...#',
      '#.........D......D.......#',
      '#....s....#..s...#...V...#',
      '#.........#......#########',
      '#........................#',
      '#...####.....ss.....####.#',
      '#......#..........#......#',
      '#..p........ss........g..#',
      '#........................#',
      '#..P....#..........#.....#',
      '#.......D....c.....D..n..#',
      '#.......#..........#.....#',
      '#....,......,,........E..#',
      '##########################',
    ],
    guards: [
      [[3, 6], [19, 6], [19, 10], [3, 10]],
      [[11, 1], [16, 1], [16, 4], [11, 4]],
    ],
    cameras: [
      { x: 10, y: 5, angle: 1.9, sweep: 0.6, speed: 0.5 },
      { x: 17, y: 4, angle: Math.PI, sweep: 0.65, speed: 0.4 },
    ],
  },
  {
    name: 'Floor 2 — The Gallery',
    brief: 'Long sightlines, a patrolled corridor, and a vault with one door.',
    parSeconds: 90,
    map: [
      '##########################',
      '#......#........#........#',
      '#..g...#...c....#...p....#',
      '#......D........D........#',
      '#......#...s....#..V.....#',
      '#..s...#........##########',
      '#........................#',
      '#######D##########D#######',
      '#........................#',
      '#..####....ss.....####...#',
      '#......#..........#......#',
      '#..p.......ss.......c....#',
      '#........................#',
      '#..P....#..........#.....#',
      '#.......D....n.....D..E..#',
      '##########################',
    ],
    guards: [
      [[3, 3], [21, 3], [21, 2], [21, 3], [3, 3], [3, 2]],
      [[2, 8], [22, 8], [22, 12], [2, 12]],
      [[12, 11], [12, 14], [17, 14], [17, 11]],
    ],
    cameras: [
      { x: 16, y: 5, angle: 2.3, sweep: 0.7, speed: 0.45 },
      { x: 12, y: 7, angle: Math.PI / 2, sweep: 0.8, speed: 0.35 },
    ],
  },
  {
    name: 'Floor 3 — The Vault',
    brief: 'The jewel sits in a steel box with a sentry inside. Good luck.',
    parSeconds: 105,
    map: [
      '##########################',
      '#....#..........#........#',
      '#..c.#....g.....#...p....#',
      '#....D..........D........#',
      '#........................#',
      '#......##########........#',
      '#......#........#........#',
      '#......#..ss....#.....g..#',
      '#......#...V....D........#',
      '#......#........#........#',
      '#......#####D####........#',
      '#........................#',
      '#..####....ss.....####...#',
      '#......#..........#......#',
      '#..P.......n........E....#',
      '##########################',
    ],
    guards: [
      [[2, 4], [23, 4], [23, 6], [18, 6], [18, 4]],
      [[2, 11], [23, 11], [23, 14], [2, 14]],
      [[9, 6], [14, 6], [14, 9], [9, 9]],
      [[19, 8], [24, 8], [24, 11], [19, 11]],
    ],
    cameras: [
      { x: 5, y: 1, angle: Math.PI / 2, sweep: 0.7, speed: 0.5 },
      { x: 16, y: 10, angle: -Math.PI / 2, sweep: 0.5, speed: 0.6 },
      { x: 0, y: 8, angle: 0, sweep: 0.6, speed: 0.4 },
    ],
  },
];

/** How many floors the heist has. */
export const FLOOR_COUNT = FLOORS.length;

const key = (x, y) => `${x},${y}`;

/**
 * Parse floor `index` into the world pieces the simulation and renderer use:
 * the wall and shadow tile sets, the spawn, the van, the jewel, the loot on
 * the floor and the guard and camera placements, all in tile coordinates.
 * Throws on a malformed map, so a bad floor fails loudly at load, not mid-run.
 */
export function buildFloor(index) {
  const def = FLOORS[index];
  if (!def) throw new Error(`no floor ${index}`);
  const walls = new Set();
  const shadows = new Set();
  const loot = [];
  let spawn = null;
  let exit = null;
  let jewel = null;
  def.map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') walls.add(key(x, y));
      else if (ch === 's') shadows.add(key(x, y));
      else if (ch === 'P') spawn = { x, y };
      else if (ch === 'E') exit = { x, y };
      else if (ch === 'V') jewel = { x, y };
      else if (LOOT_VALUES[ch]) loot.push({ x, y, kind: ch, value: LOOT_VALUES[ch], taken: false });
    });
  });
  if (!spawn || !exit || !jewel) throw new Error(`floor ${index} is missing its spawn, van or jewel`);
  return {
    name: def.name,
    brief: def.brief,
    parSeconds: def.parSeconds,
    rows: def.map,
    walls,
    shadows,
    spawn,
    exit,
    jewel: { ...jewel, taken: false },
    loot,
    guardRoutes: def.guards.map((route) => route.map(([x, y]) => ({ x, y }))),
    cameraDefs: def.cameras,
  };
}
