// sidejobs.js — work between Marisol's jobs. Drive a Solstice Cab and fares
// appear: pick the passenger up, take them where they want, get paid for
// distance with a tip for speed and a whole car. Take a boat instead and
// the marina offers courier runs between the piers and Lighthouse Isle.
// Both are endless, both pay cash, neither forgives a wrecked vehicle.

import { MARINA, ISLAND } from './config.js';
import { coastX } from './city.js';

export function createSideJobs() {
  const jobs = {
    active: null, // { kind:'taxi'|'courier', phase:'pickup'|'deliver', marker, fare... }
    cooldown: 6,

    marker() {
      return jobs.active ? jobs.active.marker : null;
    },

    label() {
      const j = jobs.active;
      if (!j) return null;
      if (j.kind === 'taxi') return j.phase === 'pickup' ? 'Taxi: pick up your fare' : 'Taxi: drop off — $' + j.fare + ' waiting';
      return j.phase === 'pickup' ? 'Courier: collect the package' : 'Courier: deliver — ' + Math.max(0, Math.ceil(j.timeLeft)) + 's left';
    },

    update(G, dt) {
      const p = G.player;
      const v = p.vehicle;
      jobs.cooldown -= dt;

      if (!jobs.active) {
        if (jobs.cooldown > 0 || !v) return;
        if (v.type === 'taxi') jobs.startTaxi(G);
        else if (v.kind === 'boat') jobs.startCourier(G);
        return;
      }

      const j = jobs.active;
      // Wrong vehicle (or on foot) for too long abandons the job.
      const rightVehicle = j.kind === 'taxi' ? v && v.type === 'taxi' : v && v.kind === 'boat';
      if (!rightVehicle) {
        j.grace = (j.grace || 0) + dt;
        if (j.grace > 10) {
          G.hud.notify('Job abandoned.');
          jobs.active = null;
          jobs.cooldown = 8;
        }
        return;
      }
      j.grace = 0;
      if (v.dead) {
        G.hud.notify('Job failed — the vehicle is wrecked.');
        G.audio.play('fail');
        jobs.active = null;
        jobs.cooldown = 8;
        return;
      }

      if (j.kind === 'courier' && j.phase === 'deliver') {
        j.timeLeft -= dt;
        if (j.timeLeft <= 0) {
          G.hud.notify('Courier run timed out.');
          G.audio.play('fail');
          jobs.active = null;
          jobs.cooldown = 8;
          return;
        }
      }

      const d = Math.hypot(v.x - j.marker.x, v.y - j.marker.y);
      const speed = Math.hypot(v.vx, v.vy);
      if (d < 64 && speed < 42) {
        if (j.phase === 'pickup') {
          j.phase = 'deliver';
          j.marker = j.dest;
          j.startHealth = v.health;
          G.audio.play('pickup');
          G.hud.notify(j.kind === 'taxi' ? 'Fare aboard! Mind the paintwork.' : 'Package aboard. Clock is running.');
        } else {
          const pay = j.kind === 'taxi' ? jobs.taxiPay(G, j, v) : j.fare;
          p.cash += pay;
          G.hud.notify((j.kind === 'taxi' ? 'Fare paid: +$' : 'Courier paid: +$') + pay);
          G.audio.play('cash');
          G.fx.text(p.x, p.y - 30, '+$' + pay, '#a3e635');
          jobs.active = null;
          jobs.cooldown = 10;
        }
      }
    },

    taxiPay(G, j, v) {
      let pay = j.fare;
      const dmg = Math.max(0, (j.startHealth || v.health) - v.health);
      if (dmg < 4) pay += Math.round(j.fare * 0.35); // untouched: full tip
      else if (dmg > 26) pay = Math.max(10, Math.round(pay * 0.5));
      return pay;
    },

    startTaxi(G) {
      const from = G.city.randomRoadPoint(G.rng);
      const to = G.city.randomRoadPoint(G.rng);
      const fare = Math.max(25, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 16));
      jobs.active = {
        kind: 'taxi', phase: 'pickup',
        marker: { x: from.x, y: from.y }, dest: { x: to.x, y: to.y }, fare,
      };
      G.hud.notify('Taxi fare waiting — follow the yellow marker.');
      G.audio.play('objective');
    },

    startCourier(G) {
      const spots = MARINA.pierYs.map((y) => ({ x: coastX(y) + MARINA.pierLen - 30, y }));
      spots.push({ x: ISLAND.x - 330, y: ISLAND.y + 130 });
      const from = spots[Math.floor(G.rng.next() * spots.length)];
      let to = from;
      while (to === from) to = spots[Math.floor(G.rng.next() * spots.length)];
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      jobs.active = {
        kind: 'courier', phase: 'pickup',
        marker: { x: from.x, y: from.y }, dest: { x: to.x, y: to.y },
        fare: Math.max(60, Math.round(dist / 9)),
        timeLeft: Math.round(dist / 9) + 30,
      };
      G.hud.notify('Courier run offered — collect at the green marker.');
      G.audio.play('objective');
    },
  };
  return jobs;
}
