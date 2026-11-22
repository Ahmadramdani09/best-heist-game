// A tiny seeded random number generator (mulberry32). The world takes one of
// these so a seed fully decides a run: the screenshot scenes name their seed
// and always stage the same frame, and a bug report can name the seed that
// produced it. Nothing in the simulation calls Math.random.

/**
 * Make a generator from a 32-bit seed. The returned function gives the next
 * number in [0, 1) each call; `int` and `range` are conveniences over it.
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A whole number in [0, exclusive). */
    int(exclusive) {
      return Math.floor(next() * exclusive);
    },
    /** A number in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
  };
}
