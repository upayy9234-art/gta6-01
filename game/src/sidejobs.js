// sidejobs.js — the work between the work: taxi fares in a Bay Cab and boat-courier
// runs out of the marina. Both are repeatable, both pay by the clock and by how
// little you bend the vehicle, and both show up on the same marker as the story.

import { dist } from './random.js';
import { isWaterAt } from './city.js';
import { sfx } from './audio.js';

export const TAXI_RANK = { x: 940, y: 2620 };
export const COURIER_DOCK = { x: 3520, y: 2020 };

export function createSideJobs() {
  return {
    active: null, // { kind:'taxi'|'courier', phase, target, timeLeft, pay, hullStart }

    offerAt(game) {
      if (this.active || game.mission.active) return null;
      const p = game.player;
      if (!p.inVehicle && dist(p.x, p.y, TAXI_RANK.x, TAXI_RANK.y) < 80) return { kind: 'taxi', label: 'E — Start a taxi shift' };
      if (dist(p.x, p.y, COURIER_DOCK.x, COURIER_DOCK.y) < 90) return { kind: 'courier', label: 'E — Boat courier run ($500)' };
      return null;
    },

    start(game, kind) {
      const rng = game.rng;
      if (kind === 'taxi') {
        // A fare waits at a random kerb; the cab is whatever Bay Cab is at the rank.
        let fx = 0;
        let fy = 0;
        for (let tries = 0; tries < 40; tries += 1) {
          const node = rng.pick(game.city.nodes);
          fx = node.x + rng.sign() * 66;
          fy = node.y + rng.range(-30, 30);
          if (!isWaterAt(fx, fy) && !game.city.collidesCircle(fx, fy, 12)) break;
        }
        this.active = { kind, phase: 'pickup', target: { x: fx, y: fy }, timeLeft: 75, pay: 0 };
        game.banner('Taxi — pick up your fare', 2.4);
        sfx.missionStart();
      } else {
        const buoys = [];
        for (let i = 0; i < 3; i += 1) {
          let buoy = { x: 4050, y: 1500 };
          for (let tries = 0; tries < 30; tries += 1) {
            const cand = { x: 3750 + rng.range(0, 750), y: 500 + rng.range(0, 2600) };
            if (isWaterAt(cand.x, cand.y)) { buoy = cand; break; }
          }
          buoys.push(buoy);
        }
        this.active = { kind, phase: 'buoys', buoys, idx: 0, target: buoys[0], timeLeft: 150, pay: 500 };
        game.banner('Boat courier — three drops across the bay', 2.4);
        sfx.missionStart();
      }
    },

    currentTarget() {
      return this.active ? this.active.target : null;
    },

    currentText() {
      const a = this.active;
      if (!a) return null;
      if (a.kind === 'taxi') return a.phase === 'pickup' ? 'Taxi: reach your fare' : 'Taxi: drop your fare off — gently';
      return `Boat courier: drop ${a.idx + 1} of 3`;
    },

    fail(game, reason) {
      if (!this.active) return;
      game.banner(`Job failed — ${reason}`, 2.4);
      sfx.fail();
      this.active = null;
    },

    update(game, dt) {
      const a = this.active;
      if (!a) return;
      a.timeLeft -= dt;
      if (a.timeLeft <= 0) { this.fail(game, 'out of time'); return; }
      const p = game.player;
      const px = p.inVehicle && p.vehicle ? p.vehicle.x : p.x;
      const py = p.inVehicle && p.vehicle ? p.vehicle.y : p.y;

      if (a.kind === 'taxi') {
        if (a.phase === 'pickup') {
          if (p.inVehicle && p.vehicle.model.taxi && dist(px, py, a.target.x, a.target.y) < 70 && Math.abs(p.vehicle.speed) < 12) {
            const dest = game.city.nearestNode(px + game.rng.range(-1600, 1600), py + game.rng.range(-1600, 1600));
            a.target = { x: dest.x + game.rng.sign() * 60, y: dest.y };
            a.phase = 'drop';
            a.timeLeft = 60 + dist(px, py, a.target.x, a.target.y) / 22;
            a.hullStart = p.vehicle.health;
            a.pay = 120 + Math.round(dist(px, py, a.target.x, a.target.y) / 9);
            sfx.pickup();
            game.banner('Fare aboard — mind the paintwork', 2);
          }
        } else if (dist(px, py, a.target.x, a.target.y) < 74 && p.inVehicle && Math.abs(p.vehicle.speed) < 12) {
          const damage = Math.max(0, (a.hullStart ?? 100) - p.vehicle.health);
          const tip = Math.max(0, Math.round(a.pay * 0.6 - damage * 3));
          game.addCash(a.pay + tip);
          game.addRespect(2);
          game.fx.addText(px, py - 30, `Fare $${a.pay}${tip ? ` + tip $${tip}` : ''}`, '#7bf1a8', 17);
          sfx.cash();
          this.active = null;
        }
      } else {
        // courier
        if (dist(px, py, a.target.x, a.target.y) < 85 && p.inVehicle && p.vehicle.kind === 'boat') {
          sfx.checkpoint();
          a.idx += 1;
          if (a.idx >= a.buoys.length) {
            game.addCash(a.pay);
            game.addRespect(3);
            game.fx.addText(px, py - 30, `Courier run +$${a.pay}`, '#7bf1a8', 17);
            sfx.cash();
            this.active = null;
          } else {
            a.target = a.buoys[a.idx];
          }
        }
      }
    },
  };
}
