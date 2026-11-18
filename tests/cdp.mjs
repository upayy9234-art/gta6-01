// Neon Harbor round 5 — interactive CDP play-test + deterministic screenshots.
// Drives headless Chromium over raw CDP (no Playwright dependency), serves
// game/ from a tiny static server, and asserts the real game loop works:
// attract mode (no input, city moves), radio ticker, shop buy, save/continue,
// missions 7→12 + finale win, garage buy, weapon pickup. Then captures the
// 4 deterministic screenshots (1280x720 JPEG q88, each <= 256 KiB).
// Run: node tests/cdp.mjs   (exit 0 = all pass)
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const gameDir = join(repo, 'game');
const shotsDir = join(repo, 'screenshots');
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const PORT = 8123;
const CDP_PORT = 9223;

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- static server ---
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(gameDir, path === '/' ? 'index.html' : path);
    if (!file.startsWith(gameDir) || !existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// --- chrome (fresh profile so no stale save leaks between runs) ---
import { rm } from 'node:fs/promises';
await rm('/tmp/gta6-r5-profile', { recursive: true, force: true });
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--mute-audio',
  `--remote-debugging-port=${CDP_PORT}`, '--window-size=1280,720',
  '--user-data-dir=/tmp/gta6-r5-profile', `http://127.0.0.1:${PORT}/?seed=1`,
], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome CDP never came up');
}

const ws = new WebSocket(await getWsUrl(), { perMessageDeflate: false });
await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const failedRequests = [];
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  if (msg.method === 'Network.loadingFailed') failedRequests.push(msg.params.errorText);
});
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('page JS error: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 500));
  return r.result?.result?.value;
}
async function key(code, k) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k ?? code.replace('Key', '').toLowerCase(), windowsVirtualKeyCode: 0 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k ?? code.replace('Key', '').toLowerCase(), windowsVirtualKeyCode: 0 });
  await sleep(120);
}
async function nav(url) {
  await send('Page.navigate', { url });
  await sleep(700);
}
async function waitForShotReady(timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await evalJs('window.__shotReady === true')) return true;
    await sleep(200);
  }
  return false;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await sleep(1500);

// ============ 1. ATTRACT MODE: no input, city must move ============
{
  const a = await evalJs(`(() => { const s = window.__neonHarbor(); return { t: s.timeOfDay, cars: s.cars.filter(c=>c.npc).map(c=>[Math.round(c.x),Math.round(c.y)]), peds: s.peds.slice(0,3).map(p=>[Math.round(p.x),Math.round(p.y)]), radio: s.radio.current }; })()`);
  await sleep(3000);
  const b = await evalJs(`(() => { const s = window.__neonHarbor(); return { t: s.timeOfDay, cars: s.cars.filter(c=>c.npc).map(c=>[Math.round(c.x),Math.round(c.y)]), peds: s.peds.slice(0,3).map(p=>[Math.round(p.x),Math.round(p.y)]), radio: s.radio.current }; })()`);
  const movedCars = a.cars.filter((c, i) => b.cars[i] && (c[0] !== b.cars[i][0] || c[1] !== b.cars[i][1])).length;
  const movedPeds = a.peds.filter((p, i) => b.peds[i] && (p[0] !== b.peds[i][0] || p[1] !== b.peds[i][1])).length;
  check('attract: traffic moves with no input', movedCars >= 5, `${movedCars}/${a.cars.length} cars moved`);
  check('attract: pedestrians move with no input', movedPeds >= 1, `${movedPeds}/3 sampled peds moved`);
  check('attract: clock advances at golden hour', b.t > a.t && b.t > 1080 && b.t < 1200, `t=${a.t.toFixed(1)} → ${b.t.toFixed(1)}`);
  check('attract: radio ticker alive', typeof b.radio === 'string' && b.radio.length > 5, b.radio);
}

// ============ 2. RADIO TICKER changes over ~6 s ============
{
  const r1 = await evalJs('window.__neonHarbor().radio.current');
  await sleep(6500);
  const r2 = await evalJs('window.__neonHarbor().radio.current');
  check('radio ticker text changes', r1 !== r2, `${r1} → ${r2}`);
}

// ============ 3. START GAME + SHOP BUY ============
await key('Space', ' ');
await sleep(400);
check('game starts on Space', (await evalJs('window.__neonHarbor().screen')) === 'play');
{
  // Move the waiting taxi passengers far from the shop first: E tries a
  // taxi pickup before opening a shop, so a fare camping the shop door
  // would steal the keypress and this shop scenario would go flaky.
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.x = 520; s.player.y = 430; s.player.money = 1000; s.player.inCar = null; for (const f of s.side.fares) { f.x = 2800; f.y = 2000; } })()`);
  await sleep(200);
  await key('KeyE', 'e');
  const open = await evalJs('window.__neonHarbor().shops.open');
  check('E near Harbor Arms opens the shop', open === 'arms', `open=${open}`);
  const before = await evalJs('({ money: window.__neonHarbor().player.money, ammo: window.__neonHarbor().weapons.ammo.smg })');
  await key('Digit1', '1');
  const after = await evalJs('({ money: window.__neonHarbor().player.money, ammo: window.__neonHarbor().weapons.ammo.smg })');
  check('shop buy: money down $150, SMG ammo +120', after.money === before.money - 150 && after.ammo === before.ammo + 120,
    `money ${before.money}→${after.money}, ammo ${before.ammo}→${after.ammo}`);
  await key('KeyE', 'e');
  check('E closes the shop', (await evalJs('window.__neonHarbor().shops.open')) === null);
}

// ============ 4. SAVE / CONTINUE across reload ============
{
  await evalJs(`(() => { const s = window.__neonHarbor(); s.missions.index = 7; s.day = 3; s.player.money = 4321; s.saveGame(); })()`);
  const saved = await evalJs('JSON.parse(window.localStorage.getItem("neon-harbor.save.v1"))');
  check('save written with mission 8/12, day 3', saved && saved.mission === 7 && saved.day === 3 && saved.money === 4321, JSON.stringify(saved));
  await nav(`http://127.0.0.1:${PORT}/?seed=1`);
  await sleep(1200);
  const stillThere = await evalJs('JSON.parse(window.localStorage.getItem("neon-harbor.save.v1"))');
  check('save survives reload', stillThere && stillThere.mission === 7, JSON.stringify(stillThere));
  await key('Space', ' ');
  await sleep(400);
  const resumed = await evalJs('({ mission: window.__neonHarbor().missions.index, money: window.__neonHarbor().player.money })');
  check('game resumes at mission 8/12 with saved cash', resumed.mission === 7 && resumed.money === 4321, JSON.stringify(resumed));
}

// ============ 5. MISSIONS 7→12 + FINALE WIN ============
{
  const drive = async (x, y, seconds = 0.6) => {
    await evalJs(`(() => { const s = window.__neonHarbor(); s.player.x = ${x}; s.player.y = ${y}; s.player.health = 100; s.player.invulnerable = 0; const input = { up:()=>false, down:()=>false, left:()=>false, right:()=>false, moveX:()=>0, run:()=>false, shooting:()=>false, mouse:()=>({x:640,y:360}) }; for (let i=0;i<${Math.round(seconds * 60)};i++) s.stepWorld(1/60, input); })()`);
  };
  await evalJs(`(() => { const s = window.__neonHarbor(); s.missions.index = 6; s.day3 = { step: 0, kills: 0 }; s.player.wanted = 0; })()`);
  const steps = [
    [1696, 824, 7, 'mission 7 crew call'],
    [1042, 800, 7, 'mission 8 pickup (step 1/2)'],
    [420, 420, 8, 'mission 8 hideout → mission 9'],
    [2132, 1260, 8, 'mission 9 bank (step 1/3)'],
    [2132, 1260, 8, 'mission 9 codes grab (step 2/3)'],
    [420, 420, 9, 'mission 9 escape → mission 10'],
    [700, 388, 9, 'mission 10 garage (step 1/2)'],
    [3120, 668, 10, 'mission 10 pier → mission 11'],
    [824, 1696, 10, 'mission 11 vault (step 1/3)'],
    [824, 1696, 10, 'mission 11 cash grab (step 2/3)'],
    [420, 420, 11, 'mission 11 escape → mission 12'],
    [824, 1696, 11, 'finale vault door (step 1/3)'],
    [824, 1696, 11, 'finale final score grab (step 2/3)'],
  ];
  for (const [x, y, want, name] of steps) {
    await drive(x, y);
    const idx = await evalJs('window.__neonHarbor().missions.index');
    check(name, idx === want, `index=${idx} want=${want}`);
  }
  const wanted = await evalJs('window.__neonHarbor().player.wanted');
  check('finale grab raises wanted to 5', wanted === 5, `wanted=${wanted}`);
  await sleep(1200);
  const heli = await evalJs('window.__neonHarbor().helis.length');
  check('heli hunts at wanted 5', heli >= 1, `helis=${heli}`);
  await drive(3120, 668, 1.2);
  const fin = await evalJs('({ done: window.__neonHarbor().missions.done, screen: window.__neonHarbor().screen, score: window.__neonHarbor().score })');
  check('finale: 12/12 done, win screen', fin.done === true && fin.screen === 'win', JSON.stringify(fin));
}

// ============ 6. GARAGE BUY ============
{
  await nav(`http://127.0.0.1:${PORT}/?seed=1`);
  await sleep(1000);
  await key('Space', ' ');
  await sleep(300);
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.x = 700; s.player.y = 388; s.player.money = 5000; s.player.inCar = null; })()`);
  await key('KeyG', 'g');
  check('G opens the garage near Virelia Motors', (await evalJs('window.__neonHarbor().garage.open')) === true);
  await key('Digit1', '1');
  const g = await evalJs('({ engine: window.__neonHarbor().garage.upgrades.engine, money: window.__neonHarbor().player.money })');
  check('garage buy: engine Lv1, money down $600', g.engine === 1 && g.money === 4400, JSON.stringify(g));
  await key('KeyG', 'g');
}

// ============ 7. WEAPON PICKUP (shotgun crate — not owned yet) ============
{
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.x = 1180; s.player.y = 800; s.player.inCar = null; const input = { up:()=>false, down:()=>false, left:()=>false, right:()=>false, moveX:()=>0, run:()=>false, shooting:()=>false, mouse:()=>({x:640,y:360}) }; for (let i=0;i<10;i++) s.stepWorld(1/60, input); })()`);
  const w = await evalJs('({ owned: window.__neonHarbor().weapons.owned.shotgun, current: window.__neonHarbor().weapons.current, ammo: window.__neonHarbor().weapons.ammo.shotgun })');
  check('weapon pickup: scattergun crate at (1180,800)', w.owned === true && w.current === 'shotgun' && w.ammo === 40, JSON.stringify(w));
}

// ============ 7b. ROUND 7: roadblocks, weather grip, taxi, postcards ============
{
  const step = async (seconds = 0.6) => {
    await evalJs(`(() => { const s = window.__neonHarbor(); const input = { up:()=>false, down:()=>false, left:()=>false, right:()=>false, moveX:()=>0, run:()=>false, shooting:()=>false, mouse:()=>({x:640,y:360}) }; for (let i=0;i<${Math.round(seconds * 60)};i++) s.stepWorld(1/60, input); })()`);
  };
  // Roadblock spawns at wanted 3, stands down below 3.
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.wanted = 3; s.player.health = 100; s.roadblocks.spawnCd = 0; })()`);
  await step(0.5);
  const rb = await evalJs(`(() => { const s = window.__neonHarbor(); return { blocks: s.roadblocks.list.length, cars: s.cars.filter(c=>c.roadblock).length }; })()`);
  check('roadblock spawns at wanted 3 (2 interceptors)', rb.blocks >= 1 && rb.cars >= 2, JSON.stringify(rb));
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.wanted = 0; s.player.health = 100; })()`);
  await step(0.3);
  const rbDown = await evalJs('window.__neonHarbor().roadblocks.list.length');
  check('roadblocks stand down below wanted 3', rbDown === 0, `blocks=${rbDown}`);
  // A third block appears once the heat reaches 4 (round 7 escalation).
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.wanted = 4; s.player.health = 100; })()`);
  for (let i = 0; i < 3; i += 1) {
    await evalJs('window.__neonHarbor().roadblocks.spawnCd = 0');
    await step(0.3);
  }
  const rb3 = await evalJs('window.__neonHarbor().roadblocks.list.length');
  check('third roadblock appears at wanted 4', rb3 === 3, `blocks=${rb3}`);
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.wanted = 0; s.player.health = 100; })()`);
  await step(0.3);
  // A second helicopter hunts at wanted 5 (lockdown).
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.wanted = 5; s.player.health = 100; })()`);
  await step(0.5);
  const helis = await evalJs('window.__neonHarbor().helis.length');
  check('second heli hunts at wanted 5', helis === 2, `helis=${helis}`);
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.wanted = 0; s.player.health = 100; })()`);
  await step(0.3);
  // Weather: a spell turns with a banner, and rain grip is really slower.
  const wx = await evalJs(`(() => { const s = window.__neonHarbor(); s.weather.timer = 0.01; s.weather.kind = 'clear'; const input = { up:()=>false, down:()=>false, left:()=>false, right:()=>false, moveX:()=>0, run:()=>false, shooting:()=>false, mouse:()=>({x:640,y:360}) }; s.stepWorld(1/60, input); return { kind: s.weather.kind, grip: s.weather.gripMul, banner: s.bannerText }; })()`);
  check('weather spell turns with a banner', wx.kind !== 'clear' && wx.grip >= 0.78 && wx.grip <= 0.95 && wx.banner.length > 5,
    `${wx.kind} grip=${wx.grip}`);
  // 12 dummy NPC cars far away keep the traffic top-up quiet during the
  // grip runs, so no fresh car spawns near the player mid-measurement.
  await evalJs(`(() => { const s = window.__neonHarbor(); for (let i = 0; i < 12; i += 1) s.cars.push({ x: 600 + i * 200, y: 2000, angle: 0, speed: 0, health: 160, maxHealth: 160, model: { name: 'Dummy', color: '#888888', speed: 1 }, npc: true, police: false, driver: true }); })()`);
  const driveSpeed = async (kind, grip) => {
    return await evalJs(`(() => {
      const s = window.__neonHarbor();
      s.weather.kind = '${kind}'; s.weather.gripMul = ${grip}; s.weather.timer = 999;
      const car = { x: 500, y: 388, angle: 0, speed: 0, health: 160, maxHealth: 160, model: { name: 'Test', color: '#ffffff', speed: 1 }, npc: false, police: false, driver: true, nitroBoost: false };
      s.player.inCar = car; s.player.x = 500; s.player.y = 388;
      const input = { up:()=>true, down:()=>false, left:()=>false, right:()=>false, moveX:()=>0, run:()=>false, shooting:()=>false, mouse:()=>({x:640,y:360}) };
      for (let i=0;i<30;i++) s.stepWorld(1/60, input);
      const v = car.speed;
      s.player.inCar = null;
      return v;
    })()`);
  };
  const drySpeed = await driveSpeed('clear', 1);
  const rainSpeed = await driveSpeed('rain', 0.82);
  check('rain grip: 0.5 s full throttle is slower by 15+', rainSpeed < drySpeed - 15, `dry=${drySpeed.toFixed(0)} rain=${rainSpeed.toFixed(0)}`);
  // Taxi: mark the nearest waiting passenger VIP, press E to pick them up.
  await evalJs(`(() => { const s = window.__neonHarbor(); const f = s.side.fares.find((x) => x.waiting); if (f) f.vip = true; })()`);
  await evalJs(`(() => { const s = window.__neonHarbor(); const f = s.side.fares.find((x) => x.waiting); s.player.x = f.x; s.player.y = f.y; s.player.inCar = null; s.player.health = 100; })()`);
  await key('KeyE', 'e');
  await sleep(400);
  const picked = await evalJs(`(() => { const s = window.__neonHarbor(); const f = s.side.activeFare; return f ? { pay: f.pay, timer: f.timer, vip: f.vip } : null; })()`);
  check('E picks up a waiting taxi passenger', picked !== null && picked.vip === true, JSON.stringify(picked));
  const vipPay = await evalJs(`(() => { const s = window.__neonHarbor(); const f = s.side.activeFare; const d = Math.hypot(f.dest.x - f.x, f.dest.y - f.y); const base = Math.min(400, Math.max(150, Math.round((150 + d * 0.22) / 10) * 10)); return { pay: f.pay, expected: Math.min(800, base * 2), timer: f.timer, expectedTimer: (d / 200 + 25) * 0.8 }; })()`);
  check('VIP fare pays double on a tighter clock', vipPay.pay === vipPay.expected && vipPay.timer <= vipPay.expectedTimer + 0.01 && vipPay.timer > vipPay.expectedTimer - 3,
    JSON.stringify(vipPay));
  // Drop-off: teleport to the flag and the fare pays out.
  const moneyBeforeDrop = await evalJs('window.__neonHarbor().player.money');
  const doneBefore = await evalJs('window.__neonHarbor().side.faresDone');
  await evalJs(`(() => { const s = window.__neonHarbor(); const f = s.side.activeFare; if (f) { s.player.x = f.dest.x; s.player.y = f.dest.y; } })()`);
  await sleep(500);
  const dropped = await evalJs(`({ done: window.__neonHarbor().side.faresDone, money: window.__neonHarbor().player.money, active: window.__neonHarbor().side.activeFare })`);
  check('taxi drop-off pays the fare', dropped.done === doneBefore + 1 && dropped.active === null && dropped.money > moneyBeforeDrop, JSON.stringify(dropped));
  // Postcard: Palm Boulevard if it is still out there, else the first one
  // left — either way the card pays +$150 exactly once.
  const pcSpot = await evalJs(`(() => { const s = window.__neonHarbor(); const c = s.side.postcards.find((x) => x.label === 'PALM BOULEVARD' && !x.taken) ?? s.side.postcards.find((x) => !x.taken); return c ? { x: c.x, y: c.y, label: c.label } : null; })()`);
  const pc0 = await evalJs(`({ collected: window.__neonHarbor().side.collected, money: window.__neonHarbor().player.money })`);
  await evalJs(`(() => { const s = window.__neonHarbor(); s.player.x = ${pcSpot.x}; s.player.y = ${pcSpot.y}; s.player.inCar = null; })()`);
  await sleep(500);
  const pc1 = await evalJs(`({ collected: window.__neonHarbor().side.collected, money: window.__neonHarbor().player.money })`);
  check(`postcard ${pcSpot.label} pays +$150`, pc1.collected === pc0.collected + 1 && pc1.money === pc0.money + 150, JSON.stringify(pc1));
  // The tenth postcard pays the $1000 hunter bonus on top of its $150.
  const bonus = await evalJs(`(() => {
    const s = window.__neonHarbor();
    s.side.postcards.forEach((c, i) => { if (i < 9) c.taken = true; });
    s.side.collected = 9; s.side.hunterBonusPaid = false;
    const last = s.side.postcards[9];
    s.player.x = last.x; s.player.y = last.y; s.player.inCar = null;
    return { money: s.player.money, score: s.score };
  })()`);
  await sleep(500);
  const bonusAfter = await evalJs(`({ collected: window.__neonHarbor().side.collected, money: window.__neonHarbor().player.money, score: window.__neonHarbor().score, hunter: window.__neonHarbor().side.hunterBonusPaid })`);
  check('tenth postcard pays the $1000 hunter bonus', bonusAfter.collected === 10 && bonusAfter.hunter === true
    && bonusAfter.money === bonus.money + 1150 && bonusAfter.score === bonus.score + 1200, JSON.stringify(bonusAfter));
}

check('no console errors during play', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 400));
check('no failed requests', failedRequests.length === 0, failedRequests.join(', '));

// ============ 8. SCREENSHOTS (deterministic ?shot= modes, seed=1) ============
// Wipe the play-test's save/best first: the shipped screenshots must show a
// fresh game, not the test profile's CONTINUE line and best score.
await nav(`http://127.0.0.1:${PORT}/?seed=1`);
await evalJs('window.localStorage.clear()');
for (const shot of ['start', 'play', 'chase', 'win']) {
  await nav(`http://127.0.0.1:${PORT}/?shot=${shot}&seed=1`);
  const ready = await waitForShotReady();
  check(`shot ${shot} renders (__shotReady)`, ready);
  await sleep(900);
  if (shot === 'play') {
    const density = await evalJs(`(() => { const s = window.__neonHarbor(); const cam = s.camera; const zoom = s.player.inCar ? 0.78 : 1; const hw = 640 / zoom, hh = 360 / zoom; const inView = (x, y) => Math.abs(x - cam.x) < hw && Math.abs(y - cam.y) < hh; return { cars: s.cars.filter((c) => inView(c.x, c.y)).length, peds: s.peds.filter((p) => inView(p.x, p.y)).length, signs: s.city.signs.filter((g) => inView(g.x, g.y)).length, timeOfDay: Math.round(s.timeOfDay) }; })()`);
    check('play frame: >=8 cars in view', density.cars >= 8, `${density.cars} cars`);
    check('play frame: >=6 pedestrians in view', density.peds >= 6, `${density.peds} peds`);
    check('play frame: >=8 named signs in view', density.signs >= 8, `${density.signs} signs`);
    check('play frame: golden hour (18:05-ish)', density.timeOfDay >= 1080 && density.timeOfDay < 1120, `timeOfDay=${density.timeOfDay}`);
  }
  const res = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  const buf = Buffer.from(res.result.data, 'base64');
  const file = join(shotsDir, { start: '1-start.jpg', play: '2-play.jpg', chase: '3-chase.jpg', win: '4-win.jpg' }[shot]);
  await writeFile(file, buf);
  const size = (await stat(file)).size;
  check(`screenshot ${shot} <= 256 KiB`, size <= 262144, `${(size / 1024).toFixed(1)} KiB`);
  console.log(`      ${file.split('/').slice(-2).join('/')}: ${(size / 1024).toFixed(1)} KiB, jpeg=${buf[0] === 0xff && buf[1] === 0xd8}`);
}

ws.close();
chrome.kill();
server.close();
console.log(failures.length === 0 ? '\nALL CDP CHECKS PASSED' : `\n${failures.length} CDP FAILURES: ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
