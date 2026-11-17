// Portside docks: the working harbour district in Virelia's south-east corner.
// Container stacks are real solid buildings (they block cars and on-foot Kai),
// gantry cranes loom over the quay, boats bob at the moorings, and three gold
// crates wait here for mission 5 — "The Portside Job". The ordinary city
// generator leaves this corner empty (see world.js) so the docks own it.
import { WORLD } from './config.js';

export const PORTSIDE = {
  x: 2380, y: 1830, w: 520, h: 520, label: 'PORTSIDE DOCKS',
  crates: [
    { x: 2450, y: 1960, taken: false },
    { x: 2720, y: 2130, taken: false },
    { x: 2820, y: 2340, taken: false },
  ],
};

// Six shipping-line colours; the yard picks three of them per seed.
const CONTAINER_COLORS = ['#b3402e', '#2e6db4', '#3d8a4a', '#c78a2e', '#7a4a9e', '#4a9e9b'];
const CONTAINER_ROWS = [1880, 2010, 2140, 2260];
const WAREHOUSE = { x: 2400, y: 2220, w: 260, h: 120 };

function overlapsWarehouse(x, y, w, h) {
  return x < WAREHOUSE.x + WAREHOUSE.w && x + w > WAREHOUSE.x
    && y < WAREHOUSE.y + WAREHOUSE.h && y + h > WAREHOUSE.y;
}

export function buildPortside(city, random) {
  // The yard's palette: three distinct container colours, no repeats.
  const palette = random.sample(CONTAINER_COLORS, 3);
  const containers = [];
  // Four rows of stacked containers. Each row starts at x=2420 and steps 86 px;
  // 2–4 stacks per row, colours drawn from the yard palette.
  for (const rowY of CONTAINER_ROWS) {
    const stacks = random.int(2, 4);
    for (let k = 0; k < stacks; k += 1) {
      const x = 2420 + k * 86;
      const y = rowY;
      // The rust-red warehouse owns the south-west corner of the yard; never
      // let a container stack overlap it.
      if (overlapsWarehouse(x, y, 78, 52)) continue;
      const entry = {
        x, y, w: 78, h: 52,
        color: random.pick(palette), neon: null, height: 1,
        windows: random.int(2, 8), container: true,
      };
      city.buildings.push(entry);
      containers.push(entry);
    }
  }
  // Rust-red warehouse with a cyan neon strip, south-west of the yard.
  city.buildings.push({
    x: WAREHOUSE.x, y: WAREHOUSE.y, w: WAREHOUSE.w, h: WAREHOUSE.h,
    color: '#8a3b2e', neon: '#22e6ff', height: 2, windows: 12, warehouse: true,
  });
  const portside = {
    cranes: [
      { x: 2460, y: 2240, arm: 210, angle: -0.5 },
      { x: 2820, y: 2240, arm: 190, angle: 0.4 },
    ],
    boats: [
      { x: 2880, y: 1920, len: 92, hue: '#d8d3c0' },
      { x: 2880, y: 2080, len: 76, hue: '#b9c0e8' },
      { x: 2880, y: 2260, len: 104, hue: '#e8a34a' },
    ],
    containers,
  };
  city.portside = portside;
  return portside;
}

export function isInPortside(x, y) {
  return x >= PORTSIDE.x && x <= PORTSIDE.x + PORTSIDE.w
    && y >= PORTSIDE.y && y <= PORTSIDE.y + PORTSIDE.h;
}

export function nextCrate(extra) {
  if (!extra || !extra.crates) return null;
  for (const crate of extra.crates) if (!crate.taken) return crate;
  return null;
}

export function drawPortside(ctx, state) {
  const port = state.city.portside;
  if (!port) return;
  const t = state.time;
  // Concrete quay strip along the river edge.
  ctx.fillStyle = '#3a3f5e';
  ctx.fillRect(2900, PORTSIDE.y, 60, PORTSIDE.h);
  ctx.fillStyle = '#ffc53d';
  for (let y = PORTSIDE.y + 20; y < PORTSIDE.y + PORTSIDE.h; y += 64) {
    ctx.fillRect(2952, y, 4, 28);
  }
  // District label, painted on the quay.
  ctx.fillStyle = '#22e6ff'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(PORTSIDE.label, PORTSIDE.x + PORTSIDE.w / 2, PORTSIDE.y + 26);
  ctx.fillStyle = '#9aa3c7'; ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('container yard · moorings · no questions asked', PORTSIDE.x + PORTSIDE.w / 2, PORTSIDE.y + 46);
  // Gantry cranes: legs, crossbeam, jib arm, hanging hook, blinking beacon.
  for (const crane of port.cranes) {
    const tipX = crane.x + Math.cos(crane.angle) * crane.arm;
    const tipY = crane.y - 150 + Math.sin(crane.angle) * crane.arm;
    ctx.strokeStyle = '#c78a2e'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(crane.x - 26, crane.y + 60); ctx.lineTo(crane.x - 14, crane.y - 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(crane.x + 26, crane.y + 60); ctx.lineTo(crane.x + 14, crane.y - 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(crane.x - 34, crane.y - 150); ctx.lineTo(crane.x + 34, crane.y - 150); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(crane.x, crane.y - 150); ctx.lineTo(tipX, tipY); ctx.stroke();
    // Hanging hook block on a cable.
    ctx.strokeStyle = '#8a8fae'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX, tipY + 46); ctx.stroke();
    ctx.fillStyle = '#e8c34a'; ctx.fillRect(tipX - 9, tipY + 46, 18, 14);
    // Red warning light blinks with the clock.
    const blink = (Math.sin(t * 2.4) > 0) ? '#ff3b30' : '#5a1a16';
    ctx.fillStyle = blink;
    ctx.beginPath(); ctx.arc(crane.x, crane.y - 162, 6, 0, Math.PI * 2); ctx.fill();
  }
  // Moored boats: hull, cabin and mast, bobbing gently on the river.
  for (const boat of port.boats) {
    const bob = Math.sin(t * 0.9 + boat.y * 0.01) * 3;
    ctx.save();
    ctx.translate(boat.x, boat.y + bob);
    ctx.fillStyle = boat.hue;
    ctx.beginPath();
    ctx.moveTo(-boat.len / 2, -8); ctx.lineTo(boat.len / 2, -8);
    ctx.lineTo(boat.len / 2 - 10, 12); ctx.lineTo(-boat.len / 2 + 10, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2f4ff'; ctx.fillRect(-16, -22, 32, 14);
    ctx.strokeStyle = '#5a3b2e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -52); ctx.stroke();
    ctx.restore();
  }
  // Mission crates: gold pulsing ring + gold square + label while untaken,
  // a faint outline once Kai has lifted one.
  const crates = state.extra ? state.extra.crates : [];
  for (const crate of crates) {
    if (!crate.taken) {
      const pulse = 1 + Math.sin(t * 5) * 0.14;
      ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(crate.x, crate.y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,197,61,0.16)';
      ctx.beginPath(); ctx.arc(crate.x, crate.y, 30 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c78a2e'; ctx.fillRect(crate.x - 13, crate.y - 13, 26, 26);
      ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 2; ctx.strokeRect(crate.x - 13, crate.y - 13, 26, 26);
      ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CRATE', crate.x, crate.y - 24);
    } else {
      ctx.strokeStyle = 'rgba(255,197,61,0.35)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(crate.x - 13, crate.y - 13, 26, 26);
    }
  }
  // Keep the world width referenced so the district never drifts off-grid.
  void WORLD.width;
}
