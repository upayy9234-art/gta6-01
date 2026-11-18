// Taxi fares + postcards: side income for Kai between missions. Up to three
// passengers wait on the roadside with a gold "$" over their heads — press E
// to pick one up, then drop them off before the timer runs out for $150–
// $400. Ten postcards hide at fixed landmarks around Virelia, $150 and score
// each; find all ten and the POSTCARD HUNTER bonus pays $1,000. Fares done
// back to back build a streak bonus, and one passenger in four is a VIP who
// pays double against a tighter clock. Everything here saves with the game.
import { POSTCARD_SPOTS, TAXI } from './config.js';
import { roadCentersX, roadCentersY, roadsidePoint } from './world.js';

export function createSide(random) {
  const side = {
    fares: [],
    activeFare: null,
    fareSpawnCd: 0,
    postcards: POSTCARD_SPOTS.map((spot) => ({ ...spot, taken: false })),
    collected: 0,
    faresDone: 0,
    faresFailed: 0,
    // Round 7: streaks, the hunter bonus and the side-income ledger.
    streak: 0,
    hunterBonusPaid: false,
    cashEarned: 0,
  };
  for (let i = 0; i < TAXI.MAX_WAITING; i += 1) side.fares.push(spawnWaitingFare(random));
  return side;
}

// A passenger waiting on the roadside. One in four is a VIP: double pay,
// a tighter clock, a purple ring instead of gold.
export function spawnWaitingFare(random) {
  const spot = roadsidePoint(random);
  return {
    x: spot.x, y: spot.y,
    waiting: true, dest: null, timer: 0, pay: 0,
    id: random.int(0, 999999999),
    vip: random.next() < 0.25,
  };
}

// Pick a drop-off on a road 500–1400 units away, ten tries, then fall back
// to 700 units east along the same road.
export function pickDestination(random, fromX, fromY) {
  for (let i = 0; i < 10; i += 1) {
    let dest;
    if (random.next() < 0.5) {
      dest = { x: random.range(200, 2900), y: random.pick(roadCentersY()) };
    } else {
      dest = { x: random.pick(roadCentersX()), y: random.range(200, 2200) };
    }
    const d = Math.hypot(dest.x - fromX, dest.y - fromY);
    if (d >= TAXI.MIN_TRIP && d <= TAXI.MAX_TRIP) return dest;
  }
  return { x: Math.min(2900, fromX + 700), y: fromY };
}

function playerPosition(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function nearestWaitingFare(state, maxDist = TAXI.PICKUP_DIST) {
  const side = state.side;
  if (!side) return null;
  const pos = playerPosition(state);
  let best = null, bestD = maxDist;
  for (const fare of side.fares) {
    if (!fare.waiting) continue;
    const d = Math.hypot(fare.x - pos.x, fare.y - pos.y);
    if (d < bestD) { bestD = d; best = fare; }
  }
  return best;
}

// E picks up a waiting passenger — or does nothing when there is none close.
export function tryTaxiPickup(state) {
  const side = state.side;
  if (!side || side.activeFare) return false;
  const fare = nearestWaitingFare(state);
  if (!fare) return false;
  const pos = playerPosition(state);
  fare.waiting = false;
  fare.dest = pickDestination(state.random, fare.x, fare.y);
  const dist = Math.hypot(fare.dest.x - fare.x, fare.dest.y - fare.y);
  let pay = Math.min(TAXI.MAX_PAY, Math.max(TAXI.MIN_PAY, Math.round((TAXI.MIN_PAY + dist * 0.22) / 10) * 10));
  let timer = dist / TAXI.SPEED + TAXI.BASE_TIME;
  // VIP: double pay (cap $800) against a clock 20% tighter.
  if (fare.vip) {
    pay = Math.min(TAXI.MAX_PAY * 2, pay * 2);
    timer *= 0.8;
  }
  fare.pay = pay;
  fare.timer = timer;
  side.activeFare = fare;
  side.fares = side.fares.filter((f) => f !== fare);
  state.audio?.taxiPickup();
  state.bannerText = '🚕 Passenger aboard — drop them off in ' + Math.ceil(timer) + 's for $' + pay + '.';
  state.bannerTimer = 3.5;
  return true;
}

// A fare ends paid or walked away. Paid fares build a streak: the second
// in a row adds $50, rising $50 per streak up to +$200.
export function finishFare(state, paid) {
  const side = state.side;
  if (!side || !side.activeFare) return;
  const fare = side.activeFare;
  if (paid) {
    let bonus = 0;
    side.streak += 1;
    if (side.streak >= 2) bonus = Math.min(200, 50 * (side.streak - 1));
    const total = fare.pay + bonus;
    state.player.money += total;
    state.score += TAXI.SCORE;
    side.faresDone += 1;
    side.cashEarned += total;
    state.audio?.taxiPaid();
    state.bannerText = side.streak >= 2
      ? '🚕 Fare complete! +$' + total + ' — ' + side.streak + ' in a row! The passenger tips their hat.'
      : '🚕 Fare complete! +$' + fare.pay + ' — the passenger tips their hat.';
    state.bannerTimer = 3.5;
  } else {
    side.faresFailed += 1;
    side.streak = 0;
    state.bannerText = '🚕 Too slow — the passenger got out and walked away.';
    state.bannerTimer = 3;
  }
  side.activeFare = null;
  side.fareSpawnCd = TAXI.RESPAWN_DELAY;
}

export function updateSide(state, dt) {
  const side = state.side;
  if (!side) return;
  const pos = playerPosition(state);
  // The active fare: drop-off in time, or the passenger walks away.
  if (side.activeFare) {
    const fare = side.activeFare;
    fare.timer -= dt;
    if (Math.hypot(pos.x - fare.dest.x, pos.y - fare.dest.y) < TAXI.DROPOFF_DIST) {
      finishFare(state, true);
    } else if (fare.timer <= 0) {
      finishFare(state, false);
    }
  }
  // Keep the roadside stocked: a fresh passenger every few seconds.
  side.fareSpawnCd -= dt;
  if (side.fares.length < TAXI.MAX_WAITING && side.fareSpawnCd <= 0) {
    side.fares.push(spawnWaitingFare(state.random));
    side.fareSpawnCd = TAXI.RESPAWN_DELAY;
  }
  // Postcards: walk or drive over one and it is yours — once only.
  for (const card of side.postcards) {
    if (card.taken) continue;
    if (Math.hypot(pos.x - card.x, pos.y - card.y) > 52) continue;
    card.taken = true;
    side.collected += 1;
    state.player.money += TAXI.POSTCARD_PAY;
    state.score += TAXI.POSTCARD_SCORE;
    side.cashEarned += TAXI.POSTCARD_PAY;
    state.audio?.pickup();
    state.bannerText = '✉️ Postcard found — ' + card.label + '! ' + side.collected + '/10 · +$150';
    state.bannerTimer = 3;
    // All ten: the POSTCARD HUNTER bonus, paid exactly once.
    if (side.collected >= side.postcards.length && !side.hunterBonusPaid) {
      side.hunterBonusPaid = true;
      state.player.money += 1000;
      state.score += 1000;
      side.cashEarned += 1000;
      state.bannerText = '✉️ POSTCARD HUNTER — all 10 found! +$1000 bonus.';
      state.bannerTimer = 4;
    }
    break; // one card per frame
  }
}

export function taxiFareText(state) {
  const fare = state.side?.activeFare;
  if (!fare) return null;
  const pos = playerPosition(state);
  return {
    timer: Math.ceil(fare.timer),
    dist: Math.round(Math.hypot(fare.dest.x - pos.x, fare.dest.y - pos.y)),
    pay: fare.pay,
    urgent: fare.timer < 10,
    vip: !!fare.vip,
  };
}

export function postcardText(state) {
  const side = state.side;
  if (!side) return 'POSTCARDS 0/10';
  return 'POSTCARDS ' + side.collected + '/' + side.postcards.length;
}

// Side income, one line: fares done, fares failed, current streak, and the
// total cash the side hustle has earned (fares + postcards + bonuses).
export function sideIncomeText(state) {
  const side = state.side;
  if (!side) return '';
  return 'FARES ' + side.faresDone + ' · FAILED ' + side.faresFailed + ' · STREAK ' + side.streak
    + ' — SIDE CASH +$' + side.cashEarned.toLocaleString('en-US');
}

export function sideSaveData(state) {
  const side = state.side;
  if (!side) return null;
  return {
    postcards: side.postcards.map((c) => c.taken),
    faresDone: side.faresDone,
    faresFailed: side.faresFailed,
    hunterBonusPaid: side.hunterBonusPaid,
    streak: side.streak,
    cashEarned: side.cashEarned,
  };
}

export function sideLoadData(state, data) {
  const side = state.side;
  if (!side || !data || typeof data !== 'object') return;
  if (Array.isArray(data.postcards)) {
    side.collected = 0;
    data.postcards.forEach((taken, i) => {
      if (side.postcards[i]) {
        side.postcards[i].taken = taken === true;
        if (taken === true) side.collected += 1;
      }
    });
  }
  if (Number.isInteger(data.faresDone)) side.faresDone = data.faresDone;
  if (Number.isInteger(data.faresFailed)) side.faresFailed = data.faresFailed;
  if (typeof data.hunterBonusPaid === 'boolean') side.hunterBonusPaid = data.hunterBonusPaid;
  if (Number.isInteger(data.streak)) side.streak = data.streak;
  if (Number.isInteger(data.cashEarned)) side.cashEarned = data.cashEarned;
}

export function drawSideMarkers(ctx, state) {
  const side = state.side;
  if (!side) return;
  const t = state.time;
  // Waiting passengers: a pulsing gold ring, a "$", a "TAXI · E" tag and a
  // little figure on the roadside. VIPs wear purple instead of gold.
  for (const fare of side.fares) {
    if (!fare.waiting) continue;
    const ring = fare.vip ? '#a06bff' : '#ffc53d';
    const pulse = 1 + Math.sin(t * 4 + (fare.id % 10)) * 0.12;
    ctx.strokeStyle = ring;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fare.x, fare.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,197,61,0.10)';
    ctx.beginPath(); ctx.arc(fare.x, fare.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ring;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', fare.x, fare.y + 7);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(fare.vip ? 'VIP TAXI · E' : 'TAXI · E', fare.x, fare.y - 32);
    // The passenger: shoulders and a head, waiting by the kerb.
    ctx.fillStyle = '#e8e4d8';
    ctx.beginPath(); ctx.arc(fare.x, fare.y + 16, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(fare.x, fare.y + 8, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // The active drop-off: a gold ring, a flag and a DROP-OFF label.
  const fare = side.activeFare;
  if (fare && fare.dest) {
    const pulse = 1 + Math.sin(t * 5) * 0.1;
    ctx.strokeStyle = '#ffc53d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(fare.dest.x, fare.dest.y, 44 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,197,61,0.16)';
    ctx.beginPath(); ctx.arc(fare.dest.x, fare.dest.y, 44 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffc53d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fare.dest.x, fare.dest.y); ctx.lineTo(fare.dest.x, fare.dest.y - 34); ctx.stroke();
    ctx.fillStyle = fare.vip ? '#a06bff' : '#ffc53d';
    ctx.beginPath();
    ctx.moveTo(fare.dest.x, fare.dest.y - 34);
    ctx.lineTo(fare.dest.x + 20, fare.dest.y - 28);
    ctx.lineTo(fare.dest.x, fare.dest.y - 22);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffc53d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DROP-OFF', fare.dest.x, fare.dest.y - 44);
  }
  // Postcards not yet found: a sparkling pink ring, an envelope, a label.
  for (const card of side.postcards) {
    if (card.taken) continue;
    const pulse = 1 + Math.sin(t * 4 + card.x) * 0.09;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6 + card.x);
    ctx.strokeStyle = '#ff5e8a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(card.x, card.y, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    // Envelope: pink-white rectangle with the V fold.
    ctx.fillStyle = '#ff5e8a';
    ctx.fillRect(card.x - 11, card.y - 8, 22, 16);
    ctx.strokeStyle = '#f2f4ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(card.x - 11, card.y - 8); ctx.lineTo(card.x, card.y + 2); ctx.lineTo(card.x + 11, card.y - 8);
    ctx.stroke();
    ctx.fillStyle = '#ff5e8a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✉ ' + card.label, card.x, card.y - 30);
  }
}
