// Everything the player sees: the bank's floors, the eyes and their cones,
// the thief, the take, and the screens around the run. Canvas 2D, flat shapes
// with soft shadows, drawn in a fixed logical view (the field plus a HUD band
// on top) that is scaled and centred on whatever canvas it is given.

import { ALARM, CAMERA, FIELD_H, FIELD_W, GUARD, JEWEL_VALUE, TILE } from './config.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_BUSTED = 'busted';

/** The HUD band's height: the field starts this far down the logical view. */
const HUD_H = 64;
const VIEW_W = FIELD_W;
const VIEW_H = FIELD_H + HUD_H;

const INK = '#0b0e14';
const GOLD = '#e8b64c';
const PAPER = '#f2ead8';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** A colour between two [r, g, b] stops, as an rgba() string. */
function mix(c1, c2, t, alpha) {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The alarm meter's colour: calm green through amber to siren red. */
function alarmColour(alarm, alpha) {
  const t = clamp01(alarm / ALARM.max);
  return t < 0.5
    ? mix([64, 190, 110], [238, 178, 60], t * 2, alpha)
    : mix([238, 178, 60], [235, 64, 52], (t - 0.5) * 2, alpha);
}

/** What the thief has taken on this floor so far, jewel included. */
function floorTake(state) {
  let sum = state.hasJewel ? JEWEL_VALUE : 0;
  for (const item of state.floor.loot) if (item.taken) sum += item.value;
  return sum;
}

/** A soft ellipse shadow under a body or a prize. */
function shadow(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    return {
      scale,
      ox: (canvas.width - VIEW_W * scale) / 2,
      oy: (canvas.height - VIEW_H * scale) / 2,
    };
  }

  // ---------------------------------------------------------------- floor

  function drawFloor(state) {
    const { rows, shadows } = state.floor;
    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < rows[y].length; x += 1) {
        const ch = rows[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (ch === '#') continue;
        if (ch === 's' || shadows.has(`${x},${y}`)) {
          ctx.fillStyle = '#232c3f';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(120,150,220,0.06)';
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        } else if (ch === ',') {
          ctx.fillStyle = (x + y) % 2 ? '#5d2430' : '#55222c';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = 'rgba(232,182,76,0.16)';
          ctx.strokeRect(px + 6.5, py + 6.5, TILE - 13, TILE - 13);
        } else {
          ctx.fillStyle = (x + y) % 2 ? '#b9b3a4' : '#aea897';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(px, py, TILE, 2);
        }
        if (ch === 'D') {
          ctx.fillStyle = '#8a6a34';
          ctx.fillRect(px, py + TILE / 2 - 3, TILE, 6);
        }
      }
    }
    // The room's skirting: a soft inner vignette so the field reads as a place.
    const grad = ctx.createRadialGradient(
      FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.42,
      FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.86,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }

  function drawWalls(state) {
    const { walls } = state.floor;
    // Shadows first, so every wall throws the same soft shade.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const key of walls) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillRect(x * TILE + 2, y * TILE + 6, TILE, TILE);
    }
    for (const key of walls) {
      const [x, y] = key.split(',').map(Number);
      const px = x * TILE;
      const py = y * TILE;
      ctx.fillStyle = '#3a4152';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#4a5268';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(px + 2, py + 2, TILE - 4, 3);
    }
  }

  // ---------------------------------------------------------------- things

  function drawVan(state) {
    const { x, y } = { x: state.floor.exit.x * TILE, y: state.floor.exit.y * TILE };
    ctx.fillStyle = '#20242e';
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    // A top-down getaway van, nose up, doors open toward the bank.
    ctx.fillStyle = '#7d8aa0';
    ctx.beginPath();
    ctx.roundRect(x + 7, y + 4, TILE - 14, TILE - 8, 5);
    ctx.fill();
    ctx.fillStyle = '#2c3547';
    ctx.fillRect(x + 10, y + 8, TILE - 20, 8);
    ctx.fillStyle = '#e8b64c';
    ctx.fillRect(x + 10, y + TILE - 9, 5, 4);
    ctx.fillRect(x + TILE - 15, y + TILE - 9, 5, 4);
    ctx.fillStyle = '#0e2a18';
    ctx.fillRect(x + 4, y - 8, TILE - 8, 9);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', x + TILE / 2, y - 1.5);
  }

  function drawLootItem(item, time) {
    const cx = item.x * TILE + TILE / 2;
    const cy = item.y * TILE + TILE / 2;
    const bob = Math.sin(time * 2 + item.x * 3 + item.y) * 1.5;
    ctx.fillStyle = 'rgba(232,182,76,0.13)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy + bob);
    if (item.kind === 'c') {
      ctx.fillStyle = '#2e7d46';
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = '#3fa45e';
      ctx.fillRect(-10, -6, 20, 4);
      ctx.fillStyle = '#e8e3c8';
      ctx.fillRect(-3, -6, 6, 12);
    } else if (item.kind === 'p') {
      ctx.fillStyle = '#8a6a34';
      ctx.fillRect(-11, -13, 22, 26);
      ctx.fillStyle = '#274b73';
      ctx.fillRect(-8, -10, 16, 20);
      ctx.fillStyle = '#7fb2e0';
      ctx.beginPath();
      ctx.moveTo(-8, 10);
      ctx.lineTo(-2, -2);
      ctx.lineTo(3, 6);
      ctx.lineTo(8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f5d76e';
      ctx.beginPath();
      ctx.arc(4, -5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 'g') {
      ctx.fillStyle = '#39c2d7';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // 'n': a string of pearls with a gold pendant.
      ctx.strokeStyle = '#e8e3da';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -2, 8, 0.3, Math.PI - 0.3);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(0, 8, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawJewel(state) {
    if (state.floor.jewel.taken) return;
    const cx = state.floor.jewel.x * TILE + TILE / 2;
    const cy = state.floor.jewel.y * TILE + TILE / 2;
    // The pedestal: concentric gold rings on a dark plinth.
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 15.5, 0, Math.PI * 2);
    ctx.stroke();
    const pulse = 1 + Math.sin(state.time * 3.2) * 0.08;
    ctx.save();
    ctx.translate(cx, cy - 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#e84fd8';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, -2);
    ctx.lineTo(0, 13);
    ctx.lineTo(-10, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, -2);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // A slow sparkle cross.
    const tw = (Math.sin(state.time * 2.1) + 1) / 2;
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + tw * 0.55})`;
    ctx.lineWidth = 1.6;
    const s = 5 + tw * 4;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - 12);
    ctx.lineTo(cx + s, cy - 12);
    ctx.moveTo(cx, cy - 12 - s);
    ctx.lineTo(cx, cy - 12 + s);
    ctx.stroke();
  }

  // ---------------------------------------------------------------- eyes

  function drawCone(state, eye, range, halfAngle, baseColour) {
    const points = conePolygon(state.floor.walls, eye.x, eye.y, eye.angle, range, halfAngle);
    const heat = eye.alert;
    ctx.fillStyle = heat > 0.03
      ? mix(baseColour, [235, 64, 52], Math.min(1, heat), 0.20)
      : `rgba(${baseColour[0]},${baseColour[1]},${baseColour[2]},0.16)`;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  function drawGuard(guard, time) {
    shadow(ctx, guard.x, guard.y + 9, 13, 5);
    // The uniform: a navy body, a peaked cap, a nose for the facing.
    ctx.fillStyle = '#26355e';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.angle) * 4, guard.y + Math.sin(guard.angle) * 4, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141c33';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 8.6, guard.angle - 2.5, guard.angle + 2.5);
    ctx.lineTo(guard.x, guard.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.fillRect(guard.x - 1.5, guard.y - 1.5, 3, 3);
    if (guard.seesThief) {
      const pop = 1 + Math.sin(time * 10) * 0.12;
      ctx.save();
      ctx.translate(guard.x + 13, guard.y - 17);
      ctx.scale(pop, pop);
      ctx.fillStyle = '#eb4034';
      ctx.font = '900 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, 0);
      ctx.restore();
    } else if (guard.alert > 0.12) {
      ctx.fillStyle = '#f5d76e';
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x + 12, guard.y - 12);
    }
  }

  function drawCamera(camera, time) {
    const { x, y } = camera;
    // The housing sits on its wall tile; the lens looks along the angle.
    ctx.fillStyle = '#161a22';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#39424f';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fd8ef';
    ctx.beginPath();
    ctx.arc(x + Math.cos(camera.angle) * 3.4, y + Math.sin(camera.angle) * 3.4, 3.1, 0, Math.PI * 2);
    ctx.fill();
    const blink = Math.sin(time * 2.6 + x) > 0.55;
    ctx.fillStyle = camera.seesThief ? '#eb4034' : blink ? '#ff5f45' : '#5c231c';
    ctx.beginPath();
    ctx.arc(x - Math.cos(camera.angle) * 5, y - Math.sin(camera.angle) * 5, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state) {
    const player = state.player;
    shadow(ctx, player.x, player.y + 10, 13, 5);
    // The swag bag grows with the take.
    const bagR = 4.5 + Math.min(7, state.lootTaken * 0.8 + (state.hasJewel ? 2.5 : 0));
    ctx.fillStyle = '#6d4c2f';
    ctx.beginPath();
    ctx.arc(player.x - Math.cos(player.angle) * 13, player.y - Math.sin(player.angle) * 13 + 2, bagR, 0, Math.PI * 2);
    ctx.fill();
    if (player.sneak) {
      ctx.strokeStyle = 'rgba(140,220,255,0.5)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 17.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // The thief: a teal hood, a masked face turned the way he moves.
    ctx.fillStyle = '#123a3f';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d5a61';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 9.6, 0, Math.PI * 2);
    ctx.fill();
    const fx = player.x + Math.cos(player.angle) * 3.6;
    const fy = player.y + Math.sin(player.angle) * 3.6;
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(fx, fy, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d2225';
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(player.angle);
    ctx.fillRect(-1, -5.4, 6.4, 3.4);
    ctx.restore();
  }

  function drawFloaters(state) {
    for (const floater of state.floaters) {
      ctx.fillStyle = `rgba(232,182,76,${Math.min(1, floater.life)})`;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(floater.text, floater.x, floater.y);
    }
  }

  // ---------------------------------------------------------------- HUD

  function drawHud(state, best) {
    ctx.fillStyle = '#101623';
    ctx.fillRect(0, 0, FIELD_W, HUD_H);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, HUD_H - 2, FIELD_W, 2);
    const floor = state.floor;
    ctx.textAlign = 'left';
    ctx.fillStyle = PAPER;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(floor.name.toUpperCase(), 14, 25);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = state.hasJewel ? '#4ade80' : '#9fb2cc';
    const objective = state.hasJewel ? 'The jewel is yours — GET TO THE VAN!' : 'Steal the Crown Jewel, then reach the van';
    ctx.fillText(objective, 14, 47);

    // Centre: the alarm meter, the loudest thing on the bar when it climbs.
    const meterW = 300;
    const meterX = FIELD_W / 2 - meterW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fb2cc';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('A L A R M', FIELD_W / 2, 15);
    ctx.fillStyle = '#232c3f';
    ctx.beginPath();
    ctx.roundRect(meterX, 21, meterW, 15, 4);
    ctx.fill();
    const alarmW = (meterW - 4) * (state.alarm / ALARM.max);
    if (alarmW > 0.5) {
      ctx.fillStyle = alarmColour(state.alarm, 0.95);
      ctx.beginPath();
      ctx.roundRect(meterX + 2, 23, alarmW, 11, 3);
      ctx.fill();
    }
    if (state.alarm > 70 && Math.sin(state.time * 9) > 0) {
      ctx.fillStyle = '#eb4034';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('THEY SEE YOU', FIELD_W / 2, 52);
    }

    // Right: the money and the clock.
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 17px system-ui, sans-serif';
    const total = state.banked + (state.cleared || state.over ? 0 : floorTake(state));
    ctx.fillText(`$${total.toLocaleString('en-US')}`, FIELD_W - 14, 26);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#9fb2cc';
    const secs = Math.floor(state.floorTime);
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const jewelMark = state.hasJewel ? '◆ jewel in the bag' : '◇ jewel still in the vault';
    ctx.fillText(`${jewelMark} · ${clock} · best $${Math.max(best, total).toLocaleString('en-US')}`, FIELD_W - 14, 48);
  }

  // ---------------------------------------------------------------- screens

  function panel(width, height) {
    const x = (FIELD_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    ctx.fillStyle = 'rgba(10,13,20,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,182,76,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return { x, y };
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(5,7,12,0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    const gold = ctx.createLinearGradient(0, 120, 0, 205);
    gold.addColorStop(0, '#f7dc8f');
    gold.addColorStop(0.55, GOLD);
    gold.addColorStop(1, '#a87b24');
    ctx.fillStyle = gold;
    ctx.font = '900 74px system-ui, sans-serif';
    ctx.fillText('VAULTBREAK', FIELD_W / 2, 196);
    ctx.fillStyle = PAPER;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('A tiny stealth heist in three floors. Take the Crown Jewel. Vanish.', FIELD_W / 2, 232);
    ctx.fillStyle = '#9fb2cc';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Move  WASD / Arrow keys / hold the mouse      Sneak  SHIFT (eyes fill slower)', FIELD_W / 2, 292);
    ctx.fillText('Stay out of the amber cones and off the cameras. Fill the alarm to 100 and the night is over.', FIELD_W / 2, 316);
    ctx.fillText('Dark carpet is shadow: stand on it and you are harder to see.', FIELD_W / 2, 340);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 19px system-ui, sans-serif';
    const pulse = 0.72 + Math.sin(state.time * 4) * 0.28;
    ctx.globalAlpha = pulse;
    ctx.fillText('PRESS ENTER OR CLICK TO CRACK THE VAULT', FIELD_W / 2, 402);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.fillStyle = GOLD;
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(`Best take so far: $${best.toLocaleString('en-US')}`, FIELD_W / 2, 436);
    }
    void state;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5,7,12,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = PAPER;
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', FIELD_W / 2, VIEW_H / 2);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#9fb2cc';
    ctx.fillText('P or Esc to slip back in', FIELD_W / 2, VIEW_H / 2 + 32);
  }

  function rankFor(banked) {
    if (banked >= 23000) return 'LEGENDARY GHOST';
    if (banked >= 19000) return 'MASTER THIEF';
    if (banked >= 15000) return 'PROFESSIONAL';
    if (banked >= 10000) return 'SMOOTH OPERATOR';
    return 'LUCKY AMATEUR';
  }

  function drawClear(state) {
    const bonus = state.lastBonus;
    const { y } = panel(520, bonus && bonus.lastFloor ? 356 : 316);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4ade80';
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.fillText(bonus && bonus.lastFloor ? 'CLEAN GETAWAY!' : 'FLOOR CLEARED!', FIELD_W / 2, y + 58);
    if (!bonus) return;
    const rows = [
      ['Loot and the jewel', `$${bonus.lootValue.toLocaleString('en-US')}`],
      ['Time bonus', `$${bonus.timeBonus.toLocaleString('en-US')}`],
      [bonus.styleName, `$${bonus.styleBonus.toLocaleString('en-US')}`],
      ['Floor total', `$${bonus.total.toLocaleString('en-US')}`],
      ['Banked so far', `$${state.banked.toLocaleString('en-US')}`],
    ];
    ctx.font = '15px system-ui, sans-serif';
    rows.forEach(([label, value], i) => {
      const ry = y + 104 + i * 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9fb2cc';
      ctx.fillText(label, FIELD_W / 2 - 190, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = i >= 3 ? GOLD : PAPER;
      ctx.fillText(value, FIELD_W / 2 + 190, ry);
    });
    ctx.textAlign = 'center';
    if (bonus.lastFloor) {
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`Crew rank: ${rankFor(state.banked)}`, FIELD_W / 2, y + 286);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('ENTER — run the whole heist again', FIELD_W / 2, y + 322);
    } else {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('ENTER — next floor', FIELD_W / 2, y + 282);
    }
  }

  function drawBusted(state) {
    ctx.fillStyle = 'rgba(60,6,4,0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const { y } = panel(520, 264);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eb4034';
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.fillText('BUSTED!', FIELD_W / 2, y + 74);
    ctx.fillStyle = PAPER;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`The alarm hit 100% on ${state.floor.name}.`, FIELD_W / 2, y + 116);
    ctx.fillText(`The crew keeps the $${state.banked.toLocaleString('en-US')} banked from earlier floors.`, FIELD_W / 2, y + 142);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('ENTER — try the heist again', FIELD_W / 2, y + 196);
  }

  // ---------------------------------------------------------------- frame

  function draw(state, screen, best) {
    const { scale, ox, oy } = fit();
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.save();
    ctx.translate(0, HUD_H);
    drawFloor(state);
    drawWalls(state);
    drawVan(state);
    for (const item of state.floor.loot) if (!item.taken) drawLootItem(item, state.time);
    drawJewel(state);
    for (const camera of state.cameras) drawCone(state, camera, CAMERA.coneRange, CAMERA.coneHalfAngle, [150, 190, 230]);
    for (const guard of state.guards) drawCone(state, guard, GUARD.coneRange, GUARD.coneHalfAngle, [240, 180, 70]);
    for (const camera of state.cameras) drawCamera(camera, state.time);
    for (const guard of state.guards) drawGuard(guard, state.time);
    drawPlayer(state);
    drawFloaters(state);
    ctx.restore();
    drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_CLEAR) drawClear(state);
    else if (screen === SCREEN_BUSTED) drawBusted(state);
    ctx.restore();
  }

  /** A field position in canvas pixels, for the pointer steering in input.js. */
  function playerScreen(state) {
    const { scale, ox, oy } = fit();
    return {
      x: ox + state.player.x * scale,
      y: oy + (HUD_H + state.player.y) * scale,
    };
  }

  return { draw, playerScreen };
}
