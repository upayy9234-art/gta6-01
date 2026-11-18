// Side hustles: taxi fares and postcard hunting. Two systems that pay Kai
// without a mission — passengers waiting on the roadside with a gold "$",
// and ten postcards hidden at fixed landmarks around Virelia. Fares pay
// $150–$400 against a clock; a streak of clean deliveries adds a bonus that
// grows with the streak; one in four passengers is a VIP who pays double on
// a tighter clock. The tenth postcard pays a $1,000 hunter bonus once.
// Everything here is seeded (state.random) and saved (see sideSaveData).
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
    streak: 0,
    cashEarned: 0,
    hunterBonusPaid: false,
  };
  for (let i = 0; i < TAXI.MAX_WAITING; i += 1) side.fares.push(spawnWaitingFare(random));
  return side;
}

export function spawnWaitingFare(random) {
  const point = roadsidePoint(random);
  return {
    x: point.x, y: point.y,
    waiting: true, dest: null, timer: 0, pay: 0,
    vip: random.next() < TAXI.VIP_CHANCE,
    id: Math.floor(random.next() * 1e9),
  };
}

// A destination 500–1400 units away, always on a road. Ten tries, then a
// fallback 700 units east on the same street.
export function pickDestination(random, fromX, fromY) {
  const xs = roadCentersX();
  const ys = roadCentersY();
  const candidates = [];
  for (let i = 0; i < 10; i += 1) {
    let dest;
    if (random.next() < 0.5) {
      dest = { x: random.range(200, 2900), y: random.pick(ys) };
    } else {
      dest = { x: random.pick(xs), y: random.range(200, 2200) };
    }
    const d = Math.hypot(dest.x - fromX, dest.y - fromY);
    if (d >= TAXI.MIN_TRIP && d <= TAXI.MAX_TRIP) candidates.push({ dest, d });
  }
  const chosen = random.pickWhere(candidates, (c) => c.d >= TAXI.MIN_TRIP && c.d <= TAXI.MAX_TRIP, 10);
  if (chosen) return chosen.dest;
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

// E near a waiting passenger: they climb in, the meter starts. Returns
// false when there is nothing to pick up.
export function tryTaxiPickup(state) {
  const side = state.side;
  if (!side || side.activeFare) return false;
  const fare = nearestWaitingFare(state);
  if (!fare) return false;
  const pos = playerPosition(state);
  fare.waiting = false;
  fare.dest = pickDestination(state.random, pos.x, pos.y);
  const dist = Math.hypot(fare.dest.x - pos.x, fare.dest.y - pos.y);
  let pay = Math.min(TAXI.MAX_PAY, Math.max(TAXI.MIN_PAY, Math.round((TAXI.MIN_PAY + dist * 0.22) / 10) * 10));
  let timer = dist / TAXI.SPEED + TAXI.BASE_TIME;
  if (fare.vip) {
    pay = Math.min(TAXI.VIP_PAY_CAP, pay * 2);
    timer *= 0.8;
  }
  fare.pay = pay;
  fare.timer = timer;
  side.activeFare = fare;
  side.fares = side.fares.filter((f) => f !== fare);
  state.audio?.taxiPickup();
  state.bannerText = '🚕 Passenger aboard — drop them off in ' + Math.ceil(timer) + 's for $' + pay + '.' + (fare.vip ? ' VIP fare — double pay!' : '');
  state.bannerTimer = 3.5;
  return true;
}

export function finishFare(state, paid) {
  const side = state.side;
  const fare = side ? side.activeFare : null;
  if (!side || !fare) return;
  if (paid) {
    let pay = fare.pay;
    // Streak bonus: the 2nd clean fare in a row adds $50, growing to a $200 cap.
    let streakBonus = 0;
    if (side.streak >= 1) streakBonus = Math.min(TAXI.STREAK_BONUS_CAP, TAXI.STREAK_BONUS * side.streak);
    pay += streakBonus;
    side.streak += 1;
    state.player.money += pay;
    state.score += TAXI.SCORE;
    side.faresDone += 1;
    side.cashEarned += pay;
    state.audio?.taxiPaid();
    state.bannerText = '🚕 Fare complete! +$' + pay + ' — the passenger tips their hat.'
      + (side.streak >= 2 ? ' Streak x' + side.streak + '!' : '')
      + (fare.vip ? ' VIP!' : '');
    state.bannerTimer = 3.5;
  } else {
    side.streak = 0;
    side.faresFailed += 1;
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
  // Active fare: clock runs down, drop-off pays, timeout fails.
  if (side.activeFare) {
    const fare = side.activeFare;
    fare.timer -= dt;
    if (Math.hypot(pos.x - fare.dest.x, pos.y - fare.dest.y) < TAXI.DROPOFF_DIST) {
      finishFare(state, true);
    } else if (fare.timer <= 0) {
      finishFare(state, false);
    }
  }
  // Refill the waiting pool, one passenger at a time.
  side.fareSpawnCd -= dt;
  if (side.fares.length < TAXI.MAX_WAITING && side.fareSpawnCd <= 0) {
    side.fares.push(spawnWaitingFare(state.random));
    side.fareSpawnCd = TAXI.RESPAWN_DELAY;
  }
  // Postcards: one per frame, at most — walk (or drive) over one to collect.
  for (const card of side.postcards) {
    if (card.taken) continue;
    if (Math.hypot(pos.x - card.x, pos.y - card.y) > 52) continue;
    card.taken = true;
    side.collected += 1;
    state.player.money += TAXI.POSTCARD_PAY;
    state.score += TAXI.POSTCARD_SCORE;
    side.cashEarned += TAXI.POSTCARD_PAY;
    state.audio?.pickup();
    state.bannerText = '✉️ Postcard found — ' + card.label + '! ' + side.collected + '/10 · +$' + TAXI.POSTCARD_PAY;
    state.bannerTimer = 3;
    // All ten: the hunter bonus, paid exactly once.
    if (side.collected >= side.postcards.length && !side.hunterBonusPaid) {
      side.hunterBonusPaid = true;
      state.player.money += TAXI.HUNTER_BONUS_CASH;
      state.score += TAXI.HUNTER_BONUS_SCORE;
      side.cashEarned += TAXI.HUNTER_BONUS_CASH;
      state.bannerText = '✉️ POSTCARD HUNTER — all 10 found! +$' + TAXI.HUNTER_BONUS_CASH + ' bonus.';
      state.bannerTimer = 4;
    }
    break;
  }
}

export function taxiFareText(state) {
  const fare = state.side ? state.side.activeFare : null;
  if (!fare) return null;
  const pos = playerPosition(state);
  return {
    timer: Math.ceil(fare.timer),
    dist: Math.round(Math.hypot(fare.dest.x - pos.x, fare.dest.y - pos.y)),
    pay: fare.pay,
    vip: !!fare.vip,
    urgent: fare.timer < 10,
  };
}

export function postcardText(state) {
  const side = state.side;
  if (!side) return 'POSTCARDS 0/10';
  return 'POSTCARDS ' + side.collected + '/' + side.postcards.length;
}

export function sideSaveData(state) {
  const side = state.side;
  if (!side) return null;
  return {
    postcards: side.postcards.map((c) => c.taken),
    faresDone: side.faresDone,
    faresFailed: side.faresFailed,
    streak: side.streak,
    cashEarned: side.cashEarned,
    hunterBonusPaid: side.hunterBonusPaid,
  };
}

export function sideLoadData(state, data) {
  const side = state.side;
  if (!side || !data) return;
  if (Array.isArray(data.postcards)) {
    side.postcards.forEach((card, i) => {
      if (data.postcards[i]) {
        card.taken = true;
      }
    });
    side.collected = side.postcards.filter((c) => c.taken).length;
  }
  if (typeof data.faresDone === 'number') side.faresDone = data.faresDone;
  if (typeof data.faresFailed === 'number') side.faresFailed = data.faresFailed;
  if (typeof data.streak === 'number') side.streak = data.streak;
  if (typeof data.cashEarned === 'number') side.cashEarned = data.cashEarned;
  if (typeof data.hunterBonusPaid === 'boolean') side.hunterBonusPaid = data.hunterBonusPaid;
}

// --- Drawing ----------------------------------------------------------------
export function drawSideMarkers(ctx, state) {
  const side = state.side;
  if (!side) return;
  const t = state.time;
  for (const fare of side.fares) {
    if (!fare.waiting) continue;
    const pulse = 1 + Math.sin(t * 4 + (fare.id % 10)) * 0.12;
    const ring = fare.vip ? '#a06bff' : '#ffc53d';
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(fare.x, fare.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = ring;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', fare.x, fare.y + 7);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(fare.vip ? 'VIP TAXI · E' : 'TAXI · E', fare.x, fare.y - 32);
    // A waiting passenger: small figure under the "$".
    ctx.fillStyle = '#e8e4d8';
    ctx.beginPath(); ctx.arc(fare.x, fare.y + 16, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(fare.x, fare.y + 11, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  const active = side.activeFare;
  if (active && active.dest) {
    const d = active.dest;
    ctx.strokeStyle = '#ffc53d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(d.x, d.y, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,197,61,0.16)';
    ctx.beginPath(); ctx.arc(d.x, d.y, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffc53d';
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - 52); ctx.lineTo(d.x - 12, d.y - 30); ctx.lineTo(d.x + 12, d.y - 30);
    ctx.closePath(); ctx.fill();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DROP-OFF', d.x, d.y - 58);
  }
  for (const card of side.postcards) {
    if (card.taken) continue;
    const pulse = 22 + Math.sin(t * 6 + card.x) * 2;
    const sparkle = 0.7 + 0.3 * Math.sin(t * 6 + card.x);
    ctx.globalAlpha = sparkle;
    ctx.strokeStyle = '#ff5e8a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(card.x, card.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    // Envelope: pink rectangle with a white V flap.
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
