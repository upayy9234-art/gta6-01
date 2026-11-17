// VPD roadblocks and the wanted-5 lockdown. Once the heat hits 3 stars the
// VPD starts sealing roads ahead of Kai: two parked interceptor cars across
// the carriageway, traffic cones, and a spike strip between them. Drive over
// the strip and the tyres go — the car takes damage and loses speed fast.
// Roadblocks melt away as soon as the wanted level drops below 3, and at
// wanted 5 the whole department locks down: patrol cars drive faster and a
// second helicopter joins the hunt (see heli.js).
import { ROADBLOCK } from './config.js';
import { makeCar } from './traffic.js';
import { nearestRoadPoint, roadCentersX } from './world.js';
import { carHitSpikeStrip } from './player.js';

const POLICE_MODEL = { name: 'VPD Interceptor', color: '#1c1f2e', speed: 1.05 };

export function createRoadblocks() {
  return { list: [], spawnCd: 0, lockdownAnnounced: false, placed: 0 };
}

// Where the next roadblock goes: a road point ahead of the player, in the
// direction Kai is facing (or a random road if he is standing still).
function roadblockSpot(state) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const angle = p.inCar ? p.inCar.angle : state.random.angle();
  const aheadX = px + Math.cos(angle) * ROADBLOCK.AHEAD;
  const aheadY = py + Math.sin(angle) * ROADBLOCK.AHEAD;
  const snapped = nearestRoadPoint(aheadX, aheadY);
  // A roadblock sits across a road: if the snapped point lies on a vertical
  // road centre the block runs east–west, otherwise north–south.
  const vertical = roadCentersX().some((cx) => Math.abs(snapped.x - cx) < 2);
  const blockAngle = vertical ? 0 : Math.PI / 2;
  return { x: snapped.x, y: snapped.y, angle: blockAngle };
}

function buildRoadblock(state) {
  const spot = roadblockSpot(state);
  const { x, y, angle } = spot;
  // Two interceptors parked across the road, nose to nose, leaving no gap.
  const across = angle + Math.PI / 2;
  const cars = [];
  for (const off of [-34, 34]) {
    const car = makeCar(
      x + Math.cos(across) * off, y + Math.sin(across) * off,
      angle, POLICE_MODEL, { npc: false, police: true },
    );
    car.speed = 0;
    car.roadblock = true;
    car.health = 120;
    car.maxHealth = 120;
    state.cars.push(car);
    cars.push(car);
  }
  // Cones fan out on the approach side; the spike strip lies in the middle.
  const approach = angle - Math.PI / 2;
  const cones = [];
  for (const off of [-70, 0, 70]) {
    cones.push({
      x: x + Math.cos(approach) * 96 + Math.cos(across) * off,
      y: y + Math.sin(approach) * 96 + Math.sin(across) * off,
    });
  }
  const strip = { x, y, angle: across };
  return { id: state.roadblocks.placed + 1, x, y, angle, cars, cones, strip };
}

export function updateRoadblocks(state, dt) {
  const rb = state.roadblocks;
  if (!rb) return;
  const wanted = state.player.wanted;
  // Wanted 5: the lockdown banner fires once per climb to five stars.
  if (wanted >= 5 && !rb.lockdownAnnounced) {
    rb.lockdownAnnounced = true;
    state.bannerText = '⚠ VPD LOCKDOWN — every unit in Virelia is hunting you.';
    state.bannerTimer = 4;
    state.audio?.siren();
  }
  if (wanted < 5) rb.lockdownAnnounced = false;
  // Heat below 3: every roadblock stands down at once.
  if (wanted < ROADBLOCK.MIN_WANTED) {
    if (rb.list.length > 0) {
      for (const block of rb.list) {
        for (const car of block.cars) {
          const idx = state.cars.indexOf(car);
          if (idx >= 0) state.cars.splice(idx, 1);
        }
      }
      rb.list = [];
    }
    return;
  }
  // Drop blocks whose cars Kai destroyed — a smashed roadblock is a way through.
  rb.list = rb.list.filter((block) => {
    const alive = block.cars.filter((c) => state.cars.includes(c));
    if (alive.length === 0) return false;
    block.cars = alive;
    return true;
  });
  rb.spawnCd -= dt;
  while (rb.list.length < ROADBLOCK.MAX_ACTIVE && rb.spawnCd <= 0) {
    const block = buildRoadblock(state);
    rb.list.push(block);
    rb.placed += 1;
    rb.spawnCd = ROADBLOCK.SPAWN_GAP;
    state.bannerText = '⚠ ROADBLOCK AHEAD — the VPD sealed the road in front of you.';
    state.bannerTimer = 3;
  }
}

// The player's car rolling over a spike strip: tyres shredded, speed halved,
// health chipped. One hit per strip per car, with a cooldown so a single
// crossing is one hit, not ten.
export function checkSpikeStrips(state, car, dt = 1 / 60) {
  const rb = state.roadblocks;
  if (!rb || !car) return false;
  car.spikeCd = Math.max(0, (car.spikeCd ?? 0) - dt);
  if (car.spikeCd > 0) return false;
  for (const block of rb.list) {
    const d = Math.hypot(car.x - block.strip.x, car.y - block.strip.y);
    if (d < ROADBLOCK.STRIP_RADIUS) {
      car.spikeCd = 2;
      carHitSpikeStrip(state, car);
      return true;
    }
  }
  return false;
}

export function nearestRoadblockDistance(state) {
  const rb = state.roadblocks;
  if (!rb || rb.list.length === 0) return Infinity;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  let best = Infinity;
  for (const block of rb.list) best = Math.min(best, Math.hypot(block.x - px, block.y - py));
  return best;
}

// True while a roadblock is close enough ahead to warn about on the HUD.
export function roadblockWarning(state) {
  const d = nearestRoadblockDistance(state);
  return d < ROADBLOCK.WARN_DIST ? Math.round(d) : null;
}

export function drawRoadblocks(ctx, state) {
  const rb = state.roadblocks;
  if (!rb) return;
  for (const block of rb.list) {
    const pulse = 1 + Math.sin(state.time * 4 + block.id) * 0.1;
    // Red warning ring on the ground so the block reads from a distance.
    ctx.strokeStyle = 'rgba(255,59,48,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(block.x, block.y, 78 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,59,48,0.08)';
    ctx.beginPath(); ctx.arc(block.x, block.y, 78 * pulse, 0, Math.PI * 2); ctx.fill();
    // Spike strip: a dark bar with steel teeth across the road.
    ctx.save();
    ctx.translate(block.strip.x, block.strip.y);
    ctx.rotate(block.strip.angle);
    ctx.fillStyle = '#15161f';
    ctx.fillRect(-52, -7, 104, 14);
    ctx.fillStyle = '#c9d2ff';
    for (let k = -4; k <= 4; k += 1) {
      ctx.beginPath();
      ctx.moveTo(k * 11 - 4, -7); ctx.lineTo(k * 11 + 4, -7); ctx.lineTo(k * 11, 0);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // Traffic cones on the approach.
    for (const cone of block.cones) {
      ctx.save();
      ctx.translate(cone.x, cone.y);
      ctx.fillStyle = '#ff7a3d';
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 8); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2f4ff';
      ctx.fillRect(-6, -2, 12, 4);
      ctx.fillStyle = '#ff7a3d';
      ctx.fillRect(-11, 8, 22, 4);
      ctx.restore();
    }
    // Label above the block.
    ctx.fillStyle = '#ff4d5e'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⛔ ROADBLOCK', block.x, block.y - 92);
  }
}
