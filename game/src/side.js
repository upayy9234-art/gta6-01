// Side activities: taxi fares and hidden postcards. Two or three Virelians
// wait at the roadside with a "$" over their heads — press E near one to pick
// them up, then drive them to their destination before the timer runs out
// for $150–$400 depending on the distance. Ten postcards are hidden at fixed
// spots around the city (the beach, the park, the pier, the Strip rooftop
// road, the docks…); walk or drive over one to collect it for $150 and score.
// Fares keep the streets alive between missions; postcards reward exploring
// every corner of Virelia. Both ride along in the save file.
import { POSTCARD_SPOTS, TAXI } from './config.js';
import { nearestRoadPoint, roadCentersX, roadCentersY, roadsidePoint } from './world.js';

export function createSide(random) {
  const side = {
    fares: [],
    activeFare: null,
    fareSpawnCd: 0,
    postcards: POSTCARD_SPOTS.map((s) => ({ ...s, taken: false })),
    collected: 0,
    faresDone: 0,
    faresFailed: 0,
  };
  for (let i = 0; i < TAXI.MAX_WAITING; i += 1) side.fares.push(spawnWaitingFare(random));
  return side;
}

// A waiting passenger stands on a road shoulder, easy to spot from the car.
export function spawnWaitingFare(random) {
  const spot = roadsidePoint(random);
  return { x: spot.x, y: spot.y, waiting: true, dest: null, timer: 0, pay: 0, id: Math.floor(random.next() * 1e9) };
}

// A fare destination: a road point a decent drive away from the pickup.
function pickDestination(random, fromX, fromY) {
  const xs = roadCentersX();
  const ys = roadCentersY();
  for (let tries = 0; tries < 10; tries += 1) {
    const horizontal = random.next() < 0.5;
    const dest = horizontal
      ? { x: random.range(200, 2900), y: random.pick(ys) }
      : { x: random.pick(xs), y: random.range(200, 2200) };
    const d = Math.hypot(dest.x - fromX, dest.y - fromY);
    if (d >= TAXI.MIN_TRIP && d <= TAXI.MAX_TRIP) return { ...dest, dist: d };
  }
  // Fallback: due east along the same road, far enough to be a real trip.
  return { x: Math.min(2900, fromX + 700), y: fromY, dist: 700 };
}

function playerPosition(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function nearestWaitingFare(state, maxDist = TAXI.PICKUP_DIST) {
  const pos = playerPosition(state);
  let best = null, bestD = maxDist;
  for (const fare of state.side.fares) {
    if (!fare.waiting) continue;
    const d = Math.hypot(fare.x - pos.x, fare.y - pos.y);
    if (d < bestD) { bestD = d; best = fare; }
  }
  return best;
}

// E near a waiting passenger: they climb in and the meter starts running.
// Returns true when a fare was picked up (so E does not also steal a car).
export function tryTaxiPickup(state) {
  const side = state.side;
  if (!side || side.activeFare) return false;
  const fare = nearestWaitingFare(state);
  if (!fare) return false;
  const pos = playerPosition(state);
  const dest = pickDestination(state.random, pos.x, pos.y);
  fare.waiting = false;
  fare.dest = dest;
  fare.timer = dest.dist / TAXI.SPEED + TAXI.BASE_TIME;
  fare.pay = Math.min(TAXI.MAX_PAY, Math.max(TAXI.MIN_PAY, Math.round((TAXI.MIN_PAY + dest.dist * 0.22) / 10) * 10));
  side.activeFare = fare;
  // The passenger leaves the roadside pool while riding with Kai.
  side.fares = side.fares.filter((f) => f !== fare);
  state.audio?.taxiPickup();
  state.bannerText = '🚕 Passenger aboard — drop them off in ' + Math.ceil(fare.timer) + 's for $' + fare.pay + '.';
  state.bannerTimer = 3.5;
  return true;
}

function finishFare(state, paid) {
  const side = state.side;
  const fare = side.activeFare;
  if (!fare) return;
  if (paid) {
    state.player.money += fare.pay;
    state.score += TAXI.SCORE;
    side.faresDone += 1;
    state.audio?.taxiPaid();
    state.bannerText = '🚕 Fare complete! +$' + fare.pay + ' — the passenger tips their hat.';
    state.bannerTimer = 3.5;
  } else {
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
  // Active fare: countdown, dropoff, or timeout.
  if (side.activeFare) {
    const fare = side.activeFare;
    fare.timer -= dt;
    if (fare.dest && Math.hypot(pos.x - fare.dest.x, pos.y - fare.dest.y) < TAXI.DROPOFF_DIST) {
      finishFare(state, true);
    } else if (fare.timer <= 0) {
      finishFare(state, false);
    }
  }
  // Keep two or three passengers waiting on the roadside.
  side.fareSpawnCd -= dt;
  if (side.fares.length < TAXI.MAX_WAITING && side.fareSpawnCd <= 0) {
    side.fares.push(spawnWaitingFare(state.random));
    side.fareSpawnCd = TAXI.RESPAWN_DELAY;
  }
  // Postcards: walk or drive over one to collect it.
  for (const card of side.postcards) {
    if (card.taken) continue;
    if (Math.hypot(pos.x - card.x, pos.y - card.y) > 52) continue;
    card.taken = true;
    side.collected += 1;
    state.player.money += TAXI.POSTCARD_PAY;
    state.score += TAXI.POSTCARD_SCORE;
    state.audio?.pickup();
    state.bannerText = '✉️ Postcard found — ' + card.label + '! ' + side.collected + '/10 · +$' + TAXI.POSTCARD_PAY;
    state.bannerTimer = 3;
    break; // one card per frame
  }
}

// HUD text for the active fare, or null when no passenger is riding.
export function taxiFareText(state) {
  const fare = state.side ? state.side.activeFare : null;
  if (!fare || !fare.dest) return null;
  const pos = playerPosition(state);
  const dist = Math.round(Math.hypot(pos.x - fare.dest.x, pos.y - fare.dest.y));
  return {
    timer: Math.max(0, Math.ceil(fare.timer)),
    dist,
    pay: fare.pay,
    urgent: fare.timer < 10,
  };
}

// "POSTCARDS 3/10" for the HUD, plus the fare count for the save file.
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
  };
}

export function sideLoadData(state, data) {
  const side = state.side;
  if (!side || !data) return;
  if (Array.isArray(data.postcards)) {
    side.collected = 0;
    side.postcards.forEach((card, i) => {
      card.taken = !!data.postcards[i];
      if (card.taken) side.collected += 1;
    });
  }
  if (Number.isInteger(data.faresDone)) side.faresDone = data.faresDone;
  if (Number.isInteger(data.faresFailed)) side.faresFailed = data.faresFailed;
}

// Draw the waiting "$" markers, the active fare destination and the
// uncollected postcards, all in world space.
export function drawSideMarkers(ctx, state) {
  const side = state.side;
  if (!side) return;
  const t = state.time;
  // Waiting passengers: gold "$" in a pulsing ring, with a "TAXI" tag.
  for (const fare of side.fares) {
    if (!fare.waiting) continue;
    const pulse = 1 + Math.sin(t * 4 + fare.id % 10) * 0.12;
    ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(fare.x, fare.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,197,61,0.14)';
    ctx.beginPath(); ctx.arc(fare.x, fare.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', fare.x, fare.y + 7);
    ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('TAXI · E', fare.x, fare.y - 34);
    // The passenger themselves: a small figure waiting at the kerb.
    ctx.fillStyle = '#e8e4d8';
    ctx.beginPath(); ctx.arc(fare.x, fare.y + 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(fare.x, fare.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Active fare destination: gold ring + flag.
  const fare = side.activeFare;
  if (fare && fare.dest) {
    const pulse = 1 + Math.sin(t * 5) * 0.12;
    ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(fare.dest.x, fare.dest.y, 44 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,197,61,0.16)';
    ctx.beginPath(); ctx.arc(fare.dest.x, fare.dest.y, 44 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffc53d';
    ctx.beginPath(); ctx.moveTo(fare.dest.x, fare.dest.y - 56); ctx.lineTo(fare.dest.x - 11, fare.dest.y - 34); ctx.lineTo(fare.dest.x + 11, fare.dest.y - 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('DROP-OFF', fare.dest.x, fare.dest.y - 64);
  }
  // Uncollected postcards: a sparkling pink envelope on the ground.
  for (const card of side.postcards) {
    if (card.taken) continue;
    const sparkle = 0.7 + 0.3 * Math.sin(t * 6 + card.x);
    ctx.save();
    ctx.globalAlpha = sparkle;
    ctx.strokeStyle = '#ff5e8a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(card.x, card.y, 22 + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff5e8a';
    ctx.fillRect(card.x - 11, card.y - 8, 22, 16);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(card.x - 11, card.y - 8); ctx.lineTo(card.x, card.y + 2); ctx.lineTo(card.x + 11, card.y - 8); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ff5e8a'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('✉ ' + card.label, card.x, card.y - 30);
  }
}
