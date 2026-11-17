// Police helicopter: spawns once the wanted level hits 4, hovers above the
// player with a lag and a bob, shines a spotlight, and shoots from the air
// at wanted level 5. One heli at most — two at wanted 5, when the VPD
// lockdown sends a second bird up from the opposite side. The helis leave
// when the heat drops below 4.
// During the Day 3 finale the heli sweeps its spotlight in a slow circle while
// it hunts, so the chase reads even from the minimap.
import { HELI } from './config.js';
import { daylight } from './daynight.js';

// The spotlight cone is faint by day and bright at night — the heli hunts
// harder when the city is dark. At golden hour it cuts through the haze.
export function heliSpotlightAlpha(state) {
  return 0.06 + 0.16 * (1 - daylight(state.timeOfDay));
}

export function ensureHeli(state) {
  // One heli at wanted 4; at wanted 5 the LOCKDOWN sends a second one up,
  // sweeping in from the opposite side so Kai is boxed in from the air.
  const want = state.player.wanted >= 5 ? 2 : state.player.wanted >= 4 ? 1 : 0;
  if (state.helis.length < want) {
    const second = state.helis.length === 1;
    state.helis.push({
      x: state.player.x + (second ? -240 : 220), y: state.player.y + (second ? 260 : -260),
      angle: 0, bob: 0, fireCooldown: 0.6, rotorPhase: 0, rotorCd: 0,
      sweep: second ? Math.PI : 0,
    });
    state.audio?.siren();
  }
  while (state.helis.length > want) state.helis.pop();
}

export function updateHeli(heli, dt, state) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  // Hover above the player, trailing behind with a lag so it never snaps.
  const tx = px + 90, ty = py - 110;
  heli.x += (tx - heli.x) * Math.min(1, dt * HELI.hoverLag);
  heli.y += (ty - heli.y) * Math.min(1, dt * HELI.hoverLag);
  heli.bob = Math.sin(state.time * 2.2) * HELI.bobAmp;
  heli.angle = Math.atan2(py - heli.y, px - heli.x);
  heli.rotorPhase += dt * 22;
  heli.rotorCd -= dt;
  // Slow spotlight sweep: the cone swings around the player while it hunts.
  heli.sweep = (heli.sweep ?? 0) + dt * 0.7;
  if (heli.rotorCd <= 0) { heli.rotorCd = 0.5; state.audio?.rotor(); }
  // At wanted 5 the heli fires down at the player.
  heli.fireCooldown -= dt;
  const d = Math.hypot(px - heli.x, py - (heli.y + heli.bob));
  if (p.wanted >= 5 && d < HELI.shootRange && heli.fireCooldown <= 0) {
    heli.fireCooldown = HELI.fireInterval;
    const a = Math.atan2(py - heli.y, px - heli.x) + (state.random.next() - 0.5) * 0.18;
    state.bullets.push({
      x: heli.x, y: heli.y + heli.bob,
      vx: Math.cos(a) * HELI.bulletSpeed, vy: Math.sin(a) * HELI.bulletSpeed,
      life: 0.9, fromPolice: true,
    });
    state.audio?.shoot();
  }
  return d;
}
