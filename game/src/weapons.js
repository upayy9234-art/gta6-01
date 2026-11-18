// Combat: four guns with their own damage, fire rate, spread, ammo and range.
// The pistol is infinite and always owned; the other three are found as
// pickups around the city (roads, Harbor Park, the Portside quay — never
// inside a building) or bought as ammo at Harbor Arms (see shops.js).
// Keys 1–4 switch between owned guns. Bad weather throws aim off: bullet
// spread grows in rain and more in a storm, so a shootout in the wet feels
// different from one under a clear sky.
export const WEAPONS = {
  pistol: {
    id: 'pistol', key: '1', name: 'Pistol', short: 'Pistol',
    dmg: 34, interval: 0.22, speed: 780, spread: 0, pellets: 1,
    ammo: Infinity, range: 0.7, color: '#ffe27a',
  },
  smg: {
    id: 'smg', key: '2', name: 'Street Sweeper SMG', short: 'SMG',
    dmg: 16, interval: 0.09, speed: 840, spread: 0.07, pellets: 1,
    ammo: 240, range: 0.55, color: '#ffb347',
  },
  shotgun: {
    id: 'shotgun', key: '3', name: 'Harbor Scattergun', short: 'Scattergun',
    dmg: 22, interval: 0.85, speed: 700, spread: 0.24, pellets: 5,
    ammo: 40, range: 0.45, color: '#ff9a5e',
  },
  rifle: {
    id: 'rifle', key: '4', name: 'Long Pier Rifle', short: 'Rifle',
    dmg: 60, interval: 0.55, speed: 1150, spread: 0.012, pellets: 1,
    ammo: 60, range: 1.1, color: '#9ae8ff',
  },
};

export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

// Every pickup sits on a road, in Harbor Park, or on the Portside quay.
export const WEAPON_PICKUPS = [
  { id: 'smg', x: 500, y: 388 },
  { id: 'shotgun', x: 1180, y: 800 },
  { id: 'rifle', x: 1820, y: 1450 },
  { id: 'smg', x: 2930, y: 2100 },
  { id: 'shotgun', x: 2850, y: 2200 },
];

export function createWeapons() {
  return {
    current: 'pistol',
    owned: { pistol: true, smg: false, shotgun: false, rifle: false },
    ammo: { pistol: Infinity, smg: 0, shotgun: 0, rifle: 0 },
    pickups: WEAPON_PICKUPS.map((p) => ({ ...p, taken: false })),
  };
}

export function currentWeapon(w) {
  return WEAPONS[w.current] ?? WEAPONS.pistol;
}

export function weaponsOwnedCount(state) {
  const w = state.weapons;
  if (!w) return 0;
  return WEAPON_ORDER.reduce((n, id) => n + (w.owned[id] ? 1 : 0), 0);
}

// Shop ammo: tops a gun up (and marks it owned if it was not). Caps at the
// gun's full mag size so a shopping spree never stacks absurd reserves.
// Returns how much ammo actually landed.
export function addAmmo(state, weaponId, amount) {
  const w = state.weapons;
  if (!w || !WEAPONS[weaponId]) return 0;
  if (!w.owned[weaponId]) w.owned[weaponId] = true;
  const cap = WEAPONS[weaponId].ammo;
  const before = w.ammo[weaponId] ?? 0;
  w.ammo[weaponId] = Math.min(cap, before + amount);
  return w.ammo[weaponId] - before;
}

// key is a digit '1'–'4' or a weapon id. Refuses guns Kai does not own yet.
export function switchWeapon(state, key) {
  const w = state.weapons;
  if (!w) return false;
  const id = WEAPON_ORDER.includes(key) ? key : WEAPON_ORDER[Number(key) - 1];
  const weapon = WEAPONS[id];
  if (!weapon) return false;
  if (!w.owned[id]) {
    state.bannerText = 'You don\u2019t own the ' + weapon.name + ' yet — find its pickup crate or buy ammo at Harbor Arms.';
    state.bannerTimer = 2.5;
    return false;
  }
  if (w.current === id) return true;
  w.current = id;
  state.audio?.pickup();
  return true;
}

// Wet-weather spread multiplier: storm throws aim off most, rain less,
// fog and clear leave the guns alone.
export function weatherSpreadMul(state) {
  const kind = state.weather ? state.weather.kind : 'clear';
  if (kind === 'storm') return 1.5;
  if (kind === 'rain') return 1.35;
  return 1;
}

export function fireWeapon(player, state) {
  const w = state.weapons;
  if (!w) return false;
  if (player.fireCooldown > 0 || player.inCar) return false;
  let weapon = currentWeapon(w);
  // Dry gun: fall back to the pistol instead of clicking empty.
  if (weapon.ammo !== Infinity && (w.ammo[weapon.id] ?? 0) <= 0) {
    w.current = 'pistol';
    weapon = WEAPONS.pistol;
    state.bannerText = 'Out of ammo — back to the pistol. Harbor Arms sells more.';
    state.bannerTimer = 2.5;
  }
  if (weapon.ammo !== Infinity) w.ammo[weapon.id] -= 1;
  player.fireCooldown = weapon.interval;
  const ox = player.x + Math.cos(player.angle) * 22;
  const oy = player.y + Math.sin(player.angle) * 22;
  const spread = weapon.spread * weatherSpreadMul(state);
  for (let i = 0; i < weapon.pellets; i += 1) {
    const a = player.angle + (state.random.next() - 0.5) * 2 * spread;
    state.bullets.push({
      x: ox, y: oy,
      vx: Math.cos(a) * weapon.speed, vy: Math.sin(a) * weapon.speed,
      life: weapon.range, fromPolice: false,
      damage: weapon.dmg, color: weapon.color,
    });
  }
  state.audio?.shoot();
  state.particles.push({
    x: player.x + Math.cos(player.angle) * 26, y: player.y + Math.sin(player.angle) * 26,
    vx: Math.cos(player.angle) * 60, vy: Math.sin(player.angle) * 60,
    life: 0.12, max: 0.12, color: weapon.color, size: 4,
  });
  return true;
}

export function updateWeaponPickups(state) {
  const w = state.weapons;
  if (!w) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const pk of w.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(px - pk.x, py - pk.y) > 46) continue;
    const weapon = WEAPONS[pk.id];
    pk.taken = true;
    if (!w.owned[pk.id]) {
      // First claim of this gun: full mag, auto-equip, score bonus.
      w.owned[pk.id] = true;
      w.ammo[pk.id] = weapon.ammo;
      w.current = pk.id;
      state.score += 100;
      state.bannerText = weapon.name + ' picked up! Press ' + weapon.key + ' to switch guns.';
      state.bannerTimer = 3;
    } else {
      // A second crate of a gun Kai already owns tops the ammo up by half a mag.
      w.ammo[pk.id] = Math.min(weapon.ammo, (w.ammo[pk.id] ?? 0) + Math.floor(weapon.ammo / 2));
      state.bannerText = weapon.name + ' ammo topped up.';
      state.bannerTimer = 2;
    }
    state.audio?.pickup();
    break; // one pickup per frame
  }
}

export function weaponHudText(state) {
  const w = state.weapons;
  if (!w) return { current: 'Pistol · ∞', owned: '1 Pistol' };
  const cur = currentWeapon(w);
  const ammoText = cur.ammo === Infinity ? '∞' : String(w.ammo[cur.id] ?? 0);
  const owned = WEAPON_ORDER.filter((id) => w.owned[id]).map((id) => {
    const wp = WEAPONS[id];
    return id === w.current ? '[' + wp.key + ' ' + wp.short + ']' : wp.key + ' ' + wp.short;
  }).join('  ');
  return { current: cur.name + ' · ' + ammoText, owned };
}

export function drawWeaponPickups(ctx, state) {
  const w = state.weapons;
  if (!w) return;
  for (const pk of w.pickups) {
    if (pk.taken) continue;
    const weapon = WEAPONS[pk.id];
    const pulse = 1 + Math.sin(state.time * 4 + pk.x) * 0.12;
    // Pulsing cyan ring on the ground.
    ctx.strokeStyle = '#22e6ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(34,230,255,0.10)';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    // Gun crate: dark box, gold trim, barrel poking out.
    ctx.fillStyle = '#1c1f2e';
    ctx.fillRect(pk.x - 15, pk.y - 10, 30, 20);
    ctx.strokeStyle = '#ffc53d';
    ctx.lineWidth = 2;
    ctx.strokeRect(pk.x - 15, pk.y - 10, 30, 20);
    ctx.strokeStyle = weapon.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pk.x - 8, pk.y); ctx.lineTo(pk.x + 14, pk.y); ctx.stroke();
    ctx.fillStyle = weapon.color;
    ctx.fillRect(pk.x - 12, pk.y - 4, 8, 8);
    // Name label above the crate.
    ctx.fillStyle = '#e8ecff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(weapon.short.toUpperCase(), pk.x, pk.y - 34);
  }
}
