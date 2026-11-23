// sidejobs.js — the honest work of Solstice Bay: taxi fares, boat courier
// runs, and the three services (garage, clinic, armoury) that keep Jax
// rolling, breathing and dangerous.

import { poi } from './city.js';
import { ECONOMY } from './config.js';
import { rand, dist } from './random.js';
import { isWater } from './city.js';

export class SideJobs {
  constructor() {
    this.taxi = null;        // { stage, pickup, drop, passengerIn, startDist, t }
    this.courier = null;     // { stage, pickup, drop }
    this.taxiCar = null;
    this.garageInside = false;
  }

  update(G, dt) {
    this.updateTaxi(G, dt);
    this.updateCourier(G, dt);
    this.updateServices(G, dt);
  }

  // --- Taxi: hop in a Cabrio and the fares find you. -----------------------
  updateTaxi(G, dt) {
    const p = G.player;
    const inTaxi = p.vehicle && p.vehicle.def.taxi;
    if (!inTaxi) {
      if (this.taxi) {
        this.taxi = null;
        this.taxiCar = null;
        G.notify('Fare cancelled — you left the cab.', '#ff8a7a');
      }
      return;
    }
    this.taxiCar = p.vehicle;
    if (!this.taxi) {
      const node = G.city.nearestNode(p.x + rand(-500, 500), p.y + rand(-500, 500));
      this.taxi = {
        stage: 'pickup',
        pickup: { x: node.x + rand(-40, 40), y: node.y + rand(-40, 40) },
        drop: null, t: 0,
      };
      G.notify('Taxi fare: pick up the passenger.', '#ffd94a');
    }
    const t = this.taxi;
    t.t += dt;
    if (t.stage === 'pickup') {
      G.sideObjective = { x: t.pickup.x, y: t.pickup.y, label: 'FARE' };
      if (dist(p.x, p.y, t.pickup.x, t.pickup.y) < 52 && Math.hypot(p.vehicle.vx, p.vehicle.vy) < 30) {
        t.stage = 'drop';
        let node = G.city.nearestNode(p.x + rand(-900, 900), p.y + rand(-900, 900));
        t.drop = { x: node.x, y: node.y };
        t.startDist = dist(p.x, p.y, t.drop.x, t.drop.y);
        t.t = 0;
        G.notify('Passenger in — off to the marker.', '#ffffff');
        G.audio.ui();
      }
    } else {
      G.sideObjective = { x: t.drop.x, y: t.drop.y, label: 'DEST' };
      if (dist(p.x, p.y, t.drop.x, t.drop.y) < 56 && Math.hypot(p.vehicle.vx, p.vehicle.vy) < 30) {
        const fare = Math.round(t.startDist * ECONOMY.taxiPerPx);
        const tip = t.t < t.startDist / 9 ? Math.round(fare * 0.4) : 0;
        G.addCash(fare + tip, p.x, p.y);
        G.notify('Fare $' + fare + (tip ? ' + $' + tip + ' tip for the hurry' : ''), '#7fe8a8');
        G.audio.cash();
        this.taxi = null;
        this.taxiCar = null;
      }
    }
  }

  // --- Boat courier: packages between piers, paid by the run. -------------
  updateCourier(G, dt) {
    const p = G.player;
    const inBoat = p.vehicle && p.vehicle.def.kind === 'boat';
    if (!inBoat) {
      if (this.courier && this.courier.stage === 'carry') {
        // Keep the job; you can hop back in a boat. Pickup lapses though.
      } else if (this.courier) {
        this.courier = null;
      }
      if (!this.courier) return;
    }
    if (!this.courier && inBoat) {
      const piers = [{ x: 3560, y: 1150 }, { x: 3750, y: 2050 }, { x: 3560, y: 2950 }, { x: 4150, y: 880 }];
      const from = piers[Math.floor(Math.random() * piers.length)];
      let to = piers[Math.floor(Math.random() * piers.length)];
      if (to === from) to = piers[(piers.indexOf(from) + 1) % piers.length];
      this.courier = { stage: 'pickup', pickup: from, drop: to };
      G.notify('Courier run offered: package at the pier marker.', '#ffd94a');
    }
    const c = this.courier;
    if (!c) return;
    if (c.stage === 'pickup') {
      G.sideObjective = { x: c.pickup.x, y: c.pickup.y, label: 'PKG' };
      if (inBoat && dist(p.x, p.y, c.pickup.x, c.pickup.y) < 80) {
        c.stage = 'carry';
        G.notify('Package aboard — deliver it across the bay.', '#ffffff');
        G.audio.pickup();
      }
    } else {
      G.sideObjective = { x: c.drop.x, y: c.drop.y, label: 'DELIVER' };
      if (inBoat && dist(p.x, p.y, c.drop.x, c.drop.y) < 85) {
        const pay = Math.round(rand(ECONOMY.courierPay[0], ECONOMY.courierPay[1]));
        G.addCash(pay, p.x, p.y);
        G.notify('Courier delivered — $' + pay, '#7fe8a8');
        G.audio.cash();
        this.courier = null;
      }
    }
    void dt;
  }

  // --- Services -------------------------------------------------------------
  updateServices(G, dt) {
    const p = G.player;
    void dt;
    // Tide Garage: drive in damaged, drive out whole (and the heat cools —
    // a fresh coat works wonders). Automatic, once per visit.
    const garage = poi('garage');
    const nearGarage = dist(p.x, p.y, garage.x, garage.y) < 95;
    if (nearGarage && p.vehicle && p.vehicle.def.kind === 'car') {
      if (!this.garageInside && p.vehicle.health < p.vehicle.def.health) {
        if (p.cash >= 150) {
          p.cash -= 150;
          p.vehicle.health = p.vehicle.def.health;
          G.wanted.heat = Math.max(0, G.wanted.heat - 60);
          G.notify('Tide Garage: repaired, resprayed, $150. Heat cooled.', '#7fe8a8');
          G.audio.cash();
          G.saveGame();
        } else {
          G.notify('Tide Garage needs $150 — you are short.', '#ff8a7a');
        }
      }
      this.garageInside = true;
    } else if (!nearGarage) {
      this.garageInside = false;
    }

    if (p.vehicle) return;
    // On foot, E works the clinic and the armoury.
    const clinic = poi('clinic');
    if (dist(p.x, p.y, clinic.x, clinic.y) < 56) {
      G.prompt = 'E — Bay Clinic: full heal, $100';
      if (G.input.hit('KeyE')) {
        if (p.cash >= 100 && p.health < 100) {
          p.cash -= 100;
          p.health = 100;
          G.notify('Patched up. Try not to bleed on the seats.', '#7fe8a8');
          G.audio.pickup();
          G.saveGame();
        } else if (p.health >= 100) {
          G.notify('You are already in one piece.', '#ffffff');
        } else {
          G.notify('The clinic needs $100.', '#ff8a7a');
        }
      }
    }
    const armoury = poi('armoury');
    if (dist(p.x, p.y, armoury.x, armoury.y) < 56) {
      G.prompt = 'E — Fort Arms: armour + ammo, $250';
      if (G.input.hit('KeyE')) {
        if (p.cash >= 250) {
          p.cash -= 250;
          p.armor = 100;
          if (p.hasPistol) p.ammo += 36;
          G.notify('Armoured up' + (p.hasPistol ? ' and restocked.' : '.'), '#7fe8a8');
          G.audio.pickup();
          G.saveGame();
        } else {
          G.notify('Fort Arms needs $250.', '#ff8a7a');
        }
      }
    }
  }
}
