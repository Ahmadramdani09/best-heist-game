// Boot and the one loop: input is read every frame, the world advances in
// fixed steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The shell owns the screens — title, play,
// paused, floor cleared, busted — and turns the world's events into screen
// changes and announcements; the world itself knows nothing of screens.
//
// ?seed=N fixes a run's seed. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CLEAR, EVENT_JEWEL, EVENT_LOOT } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function sizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
window.addEventListener('resize', sizeCanvas);
sizeCanvas();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // Paint synchronously as well as on the next frame, so the staged scene is
  // on the canvas whenever the screenshot is taken.
  renderer.draw(world.state, scene.screen, scene.best);
  requestAnimationFrame(() => {
    renderer.draw(world.state, scene.screen, scene.best);
    window.__shotReady = true;
  });
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startHeist() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`${world.state.floor.name}. Steal the Crown Jewel, then reach the van.`);
  }

  function finishRun() {
    if (world.state.banked > best) {
      best = world.state.banked;
      saveBest(best);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_BUSTED) startHeist();
      else if (screen === SCREEN_CLEAR) {
        if (world.state.lastBonus && world.state.lastBonus.lastFloor) startHeist();
        else {
          world.nextFloor();
          screen = SCREEN_PLAY;
          announce(`${world.state.floor.name}. ${world.state.floor.brief}`);
        }
      } else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dx: 0, dy: 0, sneak: false });
      return;
    }
    const direction = input.direction(renderer.playerScreen(world.state));
    const events = world.step(STEP, direction);
    if (events & EVENT_LOOT) announce(`Took loot. ${world.state.lootTaken} of ${world.state.lootTotal} on this floor.`);
    if (events & EVENT_JEWEL) announce('The Crown Jewel is in the bag. Get to the van!');
    if (events & EVENT_BUSTED) {
      finishRun();
      screen = SCREEN_BUSTED;
      announce(`Busted on ${world.state.floor.name}. Banked $${world.state.banked}.`);
    } else if (events & EVENT_CLEAR) {
      finishRun();
      screen = SCREEN_CLEAR;
      const bonus = world.state.lastBonus;
      announce(bonus && bonus.lastFloor
        ? `Clean getaway! Final take $${world.state.banked}.`
        : `Floor cleared. $${bonus ? bonus.total : 0} banked from this floor.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running heist rather than letting it play unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('VAULTBREAK. Press Enter or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
