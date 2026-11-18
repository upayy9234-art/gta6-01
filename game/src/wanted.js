// VPD roadblocks and the lockdown. Once Kai's wanted level hits 3, the VPD
// seals the road ahead of him: two interceptor cars parked sideways across
// the street, three warning cones on the approach, and a spike strip in the
// middle that shreds tyres. At wanted 5 the whole city locks down — a third
// block can be out at once, chasers drive harder, and a second helicopter
// joins the hunt (see heli.js). Below 3 stars every block stands down at
// once. Smashing a block's cars open is a legitimate way through.
import { ROADBLOCK } from './config.js';
import { makeCar } from './traffic.js';
import { nearestRoadPoint, roadCentersX } from './world.js';

const BLOCKER_MODEL = { name: 'VPD Interceptor', color: '#1c1f2e', speed: 1.05 };

export function createRoadblocks() {
  return { list: [], spawnCd: 0, lockdownAnnounced: false, placed: 0 };
}

function maxActive(state) {
  // Wanted 4 runs three blocks at once; wanted 3 runs two.
  return state.player.wanted >= 4 ? ROADBLOCK.MAX_ACTIVE_LOCKDOWN : ROADBLOCK.MAX_ACTIVE;
}

function playerPose(state) {
  const p = state.player;
  if (p.inCar) return { x: p.inCar.x, y: p.inCar.y, angle: p.inCar.angle };
  return { x: p.x, y: p.y, angle: state.random.angle() };
}

function buildBlock(state) {
  const pose = playerPose(state);
  const aheadX = pose.x + Math.cos(pose.angle) * ROADBLOCK.AHEAD;
  const aheadY = pose.y + Math.sin(pose.angle) * ROADBLOCK.AHEAD;
  const point = nearestRoadPoint(aheadX, aheadY);
  const onVertical = roadCentersX().some((cx) => Math.abs(point.x - cx) < 2);
  // A block on a vertical road lies east-west; on a horizontal road it lies
  // north-south, so the cars always sit across the traffic.
  const angle = onVertical ? 0 : Math.PI / 2;
  const px = Math.cos(angle + Math.PI / 2), py = Math.sin(angle + Math.PI / 2);
  const id = state.roadblocks.placed + 1;
  const block = { id, x: point.x, y: point.y, angle, cars: [], cones: [], strip: null };
  for (const side of [-34, 34]) {
    const car = makeCar(point.x + px * side, point.y + py * side, angle, BLOCKER_MODEL, { npc: false, police: true });
    car.speed = 0;
    car.health = 120;
    car.maxHealth = 120;
    car.roadblock = true;
    car.driver = false;
    state.cars.push(car);
    block.cars.push(car);
  }
  for (const off of [-70, 0, 70]) {
    block.cones.push({ x: point.x - Math.cos(angle) * 96 + px * off, y: point.y - Math.sin(angle) * 96 + py * off });
  }
  block.strip = { x: point.x, y: point.y, angle: angle + Math.PI / 2 };
  return block;
}

function removeBlockCars(state, block) {
  for (const car of block.cars) {
    const idx = state.cars.indexOf(car);
    if (idx >= 0) state.cars.splice(idx, 1);
  }
}

export function updateRoadblocks(state, dt) {
  const rb = state.roadblocks;
  if (!rb) return;
  const wanted = state.player.wanted;
  if (wanted >= 5 && !rb.lockdownAnnounced) {
    rb.lockdownAnnounced = true;
    state.bannerText = '⚠ VPD LOCKDOWN — every unit in Virelia is hunting you.';
    state.bannerTimer = 4;
    state.audio?.siren();
  }
  if (wanted < 5) rb.lockdownAnnounced = false;
  if (wanted < ROADBLOCK.MIN_WANTED) {
    for (const block of rb.list) removeBlockCars(state, block);
    rb.list = [];
    return;
  }
  // A block whose cars Kai destroyed is an open road again — drop it.
  rb.list = rb.list.filter((block) => {
    const alive = block.cars.some((car) => state.cars.includes(car));
    return alive;
  });
  rb.spawnCd -= dt;
  if (rb.list.length < maxActive(state) && rb.spawnCd <= 0) {
    const block = buildBlock(state);
    rb.list.push(block);
    rb.placed += 1;
    rb.spawnCd = ROADBLOCK.SPAWN_GAP;
    state.bannerText = '⚠ ROADBLOCK AHEAD — the VPD sealed the road in front of you.';
    state.bannerTimer = 3;
  }
}

// A car rolling over a strip takes damage and loses speed (see player.js).
// Returns true when the strip actually bit, so the caller can skip the rest.
export function checkSpikeStrips(state, car, dt = 1 / 60) {
  const rb = state.roadblocks;
  if (!rb || !car) return false;
  car.spikeCd = Math.max(0, (car.spikeCd ?? 0) - dt);
  if (car.spikeCd > 0) return false;
  for (const block of rb.list) {
    if (!block.strip) continue;
    if (Math.hypot(car.x - block.strip.x, car.y - block.strip.y) >= ROADBLOCK.STRIP_RADIUS) continue;
    car.spikeCd = 2;
    carHitSpikeStrip(state, car);
    return true;
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

export function roadblockWarning(state) {
  const d = nearestRoadblockDistance(state);
  return d < ROADBLOCK.WARN_DIST ? Math.round(d) : null;
}

export function drawRoadblocks(ctx, state) {
  const rb = state.roadblocks;
  if (!rb) return;
  for (const block of rb.list) {
    const pulse = 1 + Math.sin(state.time * 4 + block.id) * 0.1;
    ctx.strokeStyle = 'rgba(255,59,48,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(block.x, block.y, 78 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,59,48,0.08)';
    ctx.beginPath();
    ctx.arc(block.x, block.y, 78 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Spike strip: dark bar with nine steel teeth across the road.
    if (block.strip) {
      ctx.save();
      ctx.translate(block.strip.x, block.strip.y);
      ctx.rotate(block.strip.angle);
      ctx.fillStyle = '#15161f';
      ctx.fillRect(-52, -7, 104, 14);
      ctx.fillStyle = '#c9d2ff';
      for (let i = 0; i < 9; i += 1) {
        const tx = -44 + i * 11;
        ctx.beginPath();
        ctx.moveTo(tx, -7); ctx.lineTo(tx + 5, 0); ctx.lineTo(tx, 7);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // Warning cones on the approach side.
    for (const cone of block.cones) {
      ctx.fillStyle = '#ff7a3d';
      ctx.beginPath();
      ctx.moveTo(cone.x, cone.y - 12); ctx.lineTo(cone.x - 8, cone.y + 8); ctx.lineTo(cone.x + 8, cone.y + 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2f4ff';
      ctx.fillRect(cone.x - 6, cone.y - 2, 12, 4);
      ctx.fillStyle = '#ff7a3d';
      ctx.fillRect(cone.x - 9, cone.y + 8, 18, 3);
    }
    ctx.fillStyle = '#ff4d5e';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛔ ROADBLOCK', block.x, block.y - 92);
  }
}

// The spike-strip hit itself lives in player.js (carHitSpikeStrip) so the
// damage, slow and banner stay with the rest of the player damage code.
import { carHitSpikeStrip } from './player.js';
