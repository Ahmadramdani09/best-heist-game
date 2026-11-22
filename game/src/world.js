// The heist itself: a pure simulation with no DOM in it, stepped at a fixed
// rate by main.js (and by the screenshot staging, and by tests). The world
// owns the thief, the guards, the cameras, the alarm and the score; it
// answers events (loot taken, jewel in hand, floor cleared, busted) as bit
// flags so the shell can announce and switch screens without the simulation
// knowing screens exist.

import {
  ALARM, BONUS, CAMERA, GUARD, JEWEL_VALUE, PLAYER, TILE,
} from './config.js';
import { buildFloor, FLOOR_COUNT } from './levels.js';
import { sees, tileKey } from './vision.js';

export const EVENT_LOOT = 1;
export const EVENT_JEWEL = 2;
export const EVENT_CLEAR = 4;
export const EVENT_BUSTED = 8;

const centre = (tile) => ({ x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2 });

/** Whether a circle at (x, y) overlaps any wall tile. */
function circleHitsWall(walls, x, y, radius) {
  const minTx = Math.floor((x - radius) / TILE);
  const maxTx = Math.floor((x + radius) / TILE);
  const minTy = Math.floor((y - radius) / TILE);
  const maxTy = Math.floor((y + radius) / TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (!walls.has(tileKey(tx, ty))) continue;
      const nearX = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const nearY = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      if ((x - nearX) ** 2 + (y - nearY) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

/** Move a circle by (dx, dy), one axis at a time, so it slides along walls. */
function moveCircle(walls, body, dx, dy) {
  if (dx !== 0 && !circleHitsWall(walls, body.x + dx, body.y, body.radius)) body.x += dx;
  if (dy !== 0 && !circleHitsWall(walls, body.x, body.y + dy, body.radius)) body.y += dy;
}

/** One guard on its rounds: a waypoint loop, a pause at each stop, an eye. */
function createGuard(route) {
  const waypoints = route.map(centre);
  return {
    x: waypoints[0].x,
    y: waypoints[0].y,
    radius: GUARD.radius,
    waypoints,
    target: 1 % waypoints.length,
    pauseLeft: 0,
    angle: 0,
    scanPhase: Math.atan2(waypoints[1 % waypoints.length].y - waypoints[0].y, waypoints[1 % waypoints.length].x - waypoints[0].x),
    alert: 0,
    seesThief: false,
  };
}

/** Step one guard: walk its loop, pause and scan at each waypoint. */
function stepGuard(walls, guard, dt) {
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    // While resting, a guard looks around: its gaze sweeps around the way it came.
    guard.angle = guard.scanPhase + Math.sin(guard.pauseLeft * 2.4) * 0.85;
    return;
  }
  const target = guard.waypoints[guard.target];
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 3) {
    guard.scanPhase = guard.angle;
    guard.pauseLeft = GUARD.waypointPause;
    guard.target = (guard.target + 1) % guard.waypoints.length;
    return;
  }
  guard.angle = Math.atan2(dy, dx);
  const step = Math.min(dist, GUARD.patrolSpeed * dt);
  moveCircle(walls, guard, Math.cos(guard.angle) * step, Math.sin(guard.angle) * step);
}

/** Create the whole heist: floor 1, a fresh thief, a zeroed score. */
export function createWorld(random) {
  const state = {
    floorIndex: 0,
    floor: null,
    time: 0,
    floorTime: 0,
    player: { x: 0, y: 0, radius: PLAYER.radius, angle: -Math.PI / 2, moving: false, sneak: false },
    guards: [],
    cameras: [],
    alarm: 0,
    alarmPeak: 0,
    seenNow: false,
    hasJewel: false,
    lootTaken: 0,
    lootTotal: 0,
    banked: 0,
    lastBonus: null,
    floaters: [],
    over: false,
    cleared: false,
  };

  function loadFloor(index) {
    const floor = buildFloor(index);
    state.floorIndex = index;
    state.floor = floor;
    state.floorTime = 0;
    state.alarm = 0;
    state.alarmPeak = 0;
    state.hasJewel = false;
    state.cleared = false;
    const start = centre(floor.spawn);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.angle = -Math.PI / 2;
    state.guards = floor.guardRoutes.map(createGuard);
    state.cameras = floor.cameraDefs.map((def) => ({
      x: def.x * TILE + TILE / 2,
      y: def.y * TILE + TILE / 2,
      tileX: def.x,
      tileY: def.y,
      baseAngle: def.angle,
      sweep: def.sweep,
      speed: def.speed,
      angle: def.angle,
      alert: 0,
      seesThief: false,
    }));
    state.lootTaken = 0;
    state.lootTotal = floor.loot.length;
    state.floaters = [];
  }

  loadFloor(0);

  /** Start the whole heist over, from floor 1 with nothing banked. */
  function reset() {
    state.banked = 0;
    state.over = false;
    state.lastBonus = null;
    loadFloor(0);
  }

  /** Settle a cleared floor's score and move on (or finish the heist). */
  function settleFloor() {
    const lootValue = state.floor.loot.reduce((sum, item) => sum + (item.taken ? item.value : 0), 0)
      + (state.hasJewel ? JEWEL_VALUE : 0);
    const timeBonus = Math.max(0, Math.floor(state.floor.parSeconds - state.floorTime)) * BONUS.timePerSecond;
    const styleBonus = state.alarmPeak <= BONUS.ghostUnder ? BONUS.ghost
      : state.alarmPeak <= BONUS.shadowUnder ? BONUS.shadow : 0;
    const styleName = state.alarmPeak <= BONUS.ghostUnder ? 'Ghost bonus'
      : state.alarmPeak <= BONUS.shadowUnder ? 'Shadow bonus' : 'No style bonus';
    state.lastBonus = {
      lootValue, timeBonus, styleBonus, styleName,
      total: lootValue + timeBonus + styleBonus,
      lastFloor: state.floorIndex === FLOOR_COUNT - 1,
    };
    state.banked += state.lastBonus.total;
  }

  /**
   * Advance the world one fixed step. `input` is {dx, dy, sneak} with dx and
   * dy in [-1, 1]. Returns the EVENT_* flags raised by this step.
   */
  function step(dt, input) {
    if (state.over || state.cleared) return 0;
    let events = 0;
    state.time += dt;
    state.floorTime += dt;
    const { walls, shadows } = state.floor;
    const player = state.player;

    // The thief.
    const length = Math.hypot(input.dx, input.dy);
    player.moving = length > 0.01;
    player.sneak = Boolean(input.sneak);
    if (player.moving) {
      const speed = player.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const nx = (input.dx / Math.max(1, length)) * speed * dt;
      const ny = (input.dy / Math.max(1, length)) * speed * dt;
      player.angle = Math.atan2(input.dy, input.dx);
      moveCircle(walls, player, nx, ny);
    }

    // The guards and cameras take their turns.
    for (const guard of state.guards) stepGuard(walls, guard, dt);
    for (const camera of state.cameras) {
      camera.angle = camera.baseAngle + Math.sin(state.time * camera.speed) * camera.sweep;
    }

    // Every eye reports; the alarm believes the loudest of them.
    const onShadow = shadows.has(tileKey(Math.floor(player.x / TILE), Math.floor(player.y / TILE)));
    let fill = 0;
    const watch = (eye, range, halfAngle, rate) => {
      eye.seesThief = sees(walls, eye.x, eye.y, eye.angle, range, halfAngle, player.x, player.y);
      eye.alert = eye.seesThief ? Math.min(1, eye.alert + dt * 2.2) : Math.max(0, eye.alert - dt * 0.7);
      if (eye.seesThief) {
        const dist = Math.hypot(player.x - eye.x, player.y - eye.y);
        const closeness = 1.15 - dist / range;
        fill = Math.max(fill, rate * closeness);
      }
    };
    for (const guard of state.guards) watch(guard, GUARD.coneRange, GUARD.coneHalfAngle, GUARD.spotRate);
    for (const camera of state.cameras) watch(camera, CAMERA.coneRange, CAMERA.coneHalfAngle, CAMERA.spotRate);
    state.seenNow = fill > 0;
    if (state.seenNow) {
      if (player.sneak) fill *= ALARM.sneakFactor;
      if (onShadow) fill *= ALARM.shadowFactor;
      state.alarm = Math.min(ALARM.max, state.alarm + fill * dt);
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.decayPerSecond * dt);
    }
    state.alarmPeak = Math.max(state.alarmPeak, state.alarm);
    if (state.alarm >= ALARM.max) {
      state.over = true;
      return events | EVENT_BUSTED;
    }

    // Taking things.
    for (const item of state.floor.loot) {
      if (item.taken) continue;
      const spot = centre(item);
      if (Math.hypot(player.x - spot.x, player.y - spot.y) < 24) {
        item.taken = true;
        state.lootTaken += 1;
        events |= EVENT_LOOT;
        state.floaters.push({ x: spot.x, y: spot.y - 14, text: `+$${item.value}`, life: 1 });
      }
    }
    if (!state.hasJewel) {
      const jewelSpot = centre(state.floor.jewel);
      if (Math.hypot(player.x - jewelSpot.x, player.y - jewelSpot.y) < 24) {
        state.hasJewel = true;
        state.floor.jewel.taken = true;
        events |= EVENT_JEWEL;
        state.floaters.push({ x: jewelSpot.x, y: jewelSpot.y - 16, text: 'THE CROWN JEWEL!', life: 1.6 });
      }
    }

    // The getaway: the van only leaves with the jewel aboard.
    if (state.hasJewel) {
      const van = centre(state.floor.exit);
      if (Math.hypot(player.x - van.x, player.y - van.y) < 26) {
        settleFloor();
        state.cleared = true;
        events |= EVENT_CLEAR;
      }
    }

    // Floating score text drifts up and fades.
    for (const floater of state.floaters) {
      floater.y -= 26 * dt;
      floater.life -= dt;
    }
    state.floaters = state.floaters.filter((floater) => floater.life > 0);
    void random;
    return events;
  }

  /** Move to the next floor after a clear (the shell calls this). */
  function nextFloor() {
    if (state.floorIndex + 1 < FLOOR_COUNT) loadFloor(state.floorIndex + 1);
  }

  return { state, step, reset, nextFloor };
}
