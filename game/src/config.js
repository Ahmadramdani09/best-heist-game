// VAULTBREAK's tuning: one home for every number the other files share, so the
// simulation, the renderer and the screenshot staging all agree on the world.

/** The simulation's fixed step, in seconds: the world advances only in these. */
export const STEP = 1 / 60;

/** One map tile, in pixels. Levels are grids of these. */
export const TILE = 40;

/** The play field's size in tiles: every level map is exactly this wide and tall. */
export const GRID_W = 26;
export const GRID_H = 16;

/** The field's pixel size (the HUD rides on top of its first band, drawn by render.js). */
export const FIELD_W = GRID_W * TILE;
export const FIELD_H = GRID_H * TILE;

/** The thief. */
export const PLAYER = {
  radius: 13,
  walkSpeed: 150,
  sneakSpeed: 86,
};

/** A guard: patrol speed, how long it rests at a waypoint, and its eyes. */
export const GUARD = {
  radius: 13,
  patrolSpeed: 64,
  waypointPause: 0.9,
  coneRange: 176,
  coneHalfAngle: 0.56,
  /** Alarm points per second at point-blank range; distance and sneaking scale it down. */
  spotRate: 52,
};

/** A security camera: a slower, narrower eye that sweeps back and forth. */
export const CAMERA = {
  coneRange: 156,
  coneHalfAngle: 0.42,
  spotRate: 34,
};

/** The alarm meter: 0 is a clean job, 100 is sirens and a cell. */
export const ALARM = {
  max: 100,
  /** How fast the meter cools while nobody sees the thief. */
  decayPerSecond: 8,
  /** Standing on a shadow tile (dark carpet) slows every eye's fill by this much. */
  shadowFactor: 0.55,
  /** Sneaking slows every eye's fill by this much. */
  sneakFactor: 0.55,
};

/** What each loot kind pays, by its map letter. */
export const LOOT_VALUES = {
  c: 250, // a stack of banded cash
  p: 500, // a framed painting
  g: 750, // a cut gem
  n: 400, // a pearl necklace
};

/** The one prize every floor is built around: the Crown Jewel in its vault. */
export const JEWEL_VALUE = 5000;

/** Score bonuses settled when a floor is cleared. */
export const BONUS = {
  /** Per whole second under par, in dollars. */
  timePerSecond: 10,
  /** The alarm never rose past the lower mark: a ghost run. */
  ghostUnder: 25,
  ghost: 1500,
  /** The alarm never rose past the higher mark: a shadow run. */
  shadowUnder: 60,
  shadow: 750,
};

/** localStorage key for the best total score. */
export const BEST_KEY = 'vaultbreak-best';
