// VPD roadblocks + lockdown: once the heat hits 3 stars the police seal the
// road ahead of Kai with two parked interceptors, three cones and a spike
// strip. Smash the interceptors or turn around — the block stands down when
// the wanted level drops below 3. At wanted 5 the whole city locks down:
// every chaser drives harder and a second helicopter joins the hunt.
import { ROADBLOCK } from './config.js';
import { makeCar } from './traffic.js';
import { nearestRoadPoint, roadCentersX } from './world.js';
import { carHitSpikeStrip } from './player.js';

const BLOCK_MODEL = { name: 'VPD Interceptor', color: '#1c1f2e', speed: 1.05 };

export function createRoadblocks() {
  return { list: [], spawnCd: 0, lockdownAnnounced: false, placed: 0 };
}

// How many blocks may stand at once: two at wanted 3, three once the heat
// reaches 4 — the VPD seals more road the hotter Kai gets.
export function maxActiveBlocks(wanted) {
  return wanted >= 4 ? ROADBLOCK.MAX_ACTIVE + 1 : ROADBLOCK.MAX_ACTIVE;
}

function blockAheadPoint(state) {
  const p = state.player;
  const car = p.inCar;
  // On foot Kai's facing is his aim; in a car the roadblock sits ahead of
  // the bonnet. On foot the heading is a fresh random compass angle.
  const angle = car ? car.angle : state.random.angle();
  const ox = car ? car.x : p.x;
  const oy = car ? car.y : p.y;
  const raw = {
    x: ox + Math.cos(angle) * ROADBLOCK.AHEAD,
    y: oy + Math.sin(angle) * ROADBLOCK.AHEAD,
  };
  return nearestRoadPoint(raw.x, raw.y);
}

function spawnBlock(state) {
  const p = state.player;
  const point = blockAheadPoint(state);
  // A block on a vertical road runs east–west across it; anywhere else it
  // runs north–south. The snap point sits on a road centre either way.
  const onVertical = roadCentersX().some((cx) => Math.abs(point.x - cx) < 2);
  const angle = onVertical ? 0 : Math.PI / 2;
  const id = state.roadblocks.placed + 1;
  const px = Math.cos(angle + Math.PI / 2), py = Math.sin(angle + Math.PI / 2);
  const block = {
    id, x: point.x, y: point.y, angle,
    cars: [], cones: [],
    strip: { x: point.x, y: point.y, angle },
  };
  // Two interceptors parked across the road, nose to nose with the traffic.
  for (const side of [-34, 34]) {
    const car = makeCar(point.x + px * side, point.y + py * side, angle, BLOCK_MODEL, { npc: false, police: true });
    car.speed = 0;
    car.roadblock = true;
    car.health = 120;
    car.maxHealth = 120;
    block.cars.push(car);
    state.cars.push(car);
  }
  // Three cones on the approach side, where Kai first sees the seal.
  const ax = (p.inCar ? p.inCar.x : p.x) - point.x;
  const ay = (p.inCar ? p.inCar.y : p.y) - point.y;
  const alen = Math.hypot(ax, ay) || 1;
  const ux = ax / alen, uy = ay / alen;
  for (const off of [-70, 0, 70]) {
    block.cones.push({
      x: point.x + ux * 96 + px * off,
      y: point.y + uy * 96 + py * off,
    });
  }
  state.roadblocks.list.push(block);
  state.roadblocks.placed += 1;
  return block;
}

export function updateRoadblocks(state, dt) {
  const rb = state.roadblocks;
  if (!rb) return;
  const wanted = state.player.wanted;
  rb.spawnCd -= dt;
  if (wanted < 5) rb.lockdownAnnounced = false;
  // Heat below 3 stars: the VPD stands the blocks down at once.
  if (wanted < ROADBLOCK.MIN_WANTED) {
    for (const block of rb.list) {
      for (const car of block.cars) {
        const idx = state.cars.indexOf(car);
        if (idx >= 0) state.cars.splice(idx, 1);
      }
    }
    rb.list = [];
    return;
  }
  // A block whose interceptors Kai smashed is a road that is open again.
  rb.list = rb.list.filter((block) => block.cars.some((car) => state.cars.includes(car)));
  // Seal the road ahead, at most one new block per spawn gap.
  if (rb.list.length < maxActiveBlocks(wanted) && rb.spawnCd <= 0) {
    spawnBlock(state);
    rb.spawnCd = ROADBLOCK.SPAWN_GAP;
    state.bannerText = '⚠ ROADBLOCK AHEAD — the VPD sealed the road in front of you.';
    state.bannerTimer = 3;
  }
  // Lockdown, announced last so its banner wins over a same-frame seal:
  // at five stars every unit in Virelia is hunting Kai.
  if (wanted >= 5 && !rb.lockdownAnnounced) {
    rb.lockdownAnnounced = true;
    state.bannerText = '⚠ VPD LOCKDOWN — every unit in Virelia is hunting you.';
    state.bannerTimer = 4;
    state.audio?.siren();
  }
}

// A car rolling over a strip shreds its tyres — unless it just did.
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

function playerPosition(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function nearestRoadblockDistance(state) {
  const rb = state.roadblocks;
  if (!rb || rb.list.length === 0) return Infinity;
  const pos = playerPosition(state);
  let best = Infinity;
  for (const block of rb.list) best = Math.min(best, Math.hypot(block.x - pos.x, block.y - pos.y));
  return best;
}

// Rounded metres to the nearest block, or null when none is close enough
// to warn about.
export function roadblockWarning(state) {
  const d = nearestRoadblockDistance(state);
  return d < ROADBLOCK.WARN_DIST ? Math.round(d) : null;
}

export function drawRoadblocks(ctx, state) {
  const rb = state.roadblocks;
  if (!rb) return;
  for (const block of rb.list) {
    // Pulsing red ring: the seal reads from a block away.
    const pulse = 1 + Math.sin(state.time * 4 + block.id) * 0.1;
    ctx.strokeStyle = 'rgba(255,59,48,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(block.x, block.y, 78 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,59,48,0.08)';
    ctx.beginPath(); ctx.arc(block.x, block.y, 78 * pulse, 0, Math.PI * 2); ctx.fill();
    // Spike strip: a dark bar across the road with nine steel teeth.
    ctx.save();
    ctx.translate(block.strip.x, block.strip.y);
    ctx.rotate(block.strip.angle);
    ctx.fillStyle = '#15161f';
    ctx.fillRect(-52, -7, 104, 14);
    ctx.fillStyle = '#c9d2ff';
    for (let i = 0; i < 9; i += 1) {
      const tx = -46 + i * 11.5;
      ctx.beginPath();
      ctx.moveTo(tx, -8); ctx.lineTo(tx + 6, 0); ctx.lineTo(tx, 8);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // Cones on the approach side: orange triangle, white band, dark base.
    for (const cone of block.cones) {
      ctx.fillStyle = '#ff7a3d';
      ctx.beginPath();
      ctx.moveTo(cone.x, cone.y - 11); ctx.lineTo(cone.x - 8, cone.y + 8); ctx.lineTo(cone.x + 8, cone.y + 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2f4ff';
      ctx.fillRect(cone.x - 5, cone.y - 2, 10, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(cone.x - 9, cone.y + 8, 18, 3);
    }
    // Label above the seal.
    ctx.fillStyle = '#ff4d5e';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛔ ROADBLOCK', block.x, block.y - 92);
  }
}
