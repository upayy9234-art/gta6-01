// Solstice Heat: Neon Tide — missions.js
// Mission framework (goto/chase/tail/escort/survive/deliver/race) + 12-mission
// story for fixer Marisol Vega, plus 3-step guided onboarding.
window.SH = window.SH || {};
SH.missions = (function () {
  'use strict';
  var R = SH.random, B = SH.config.BALANCE, S = SH.city.missionSpots;
  var active = null;      // {def, step, timer, targetRec, markerMesh, ...}
  var available = true;   // story marker active when no mission running
  var markerMesh = null, storyMarker = null;
  var onboardStep = 0;
  // ---- Story definitions, built in init() after the city exists (spot coords
  // are only known once SH.city.build has run). Step: {type,x,z,label,sub,time?}
  var STORY = [];
  function buildStory() { STORY = [
    { title: 'First Wheel', intro: 'Marisol: "Jax. You drive, you get paid, you ask nothing. Prove it — take my coupe to the Marina."',
      steps: [
        { type: 'goto', x: -46, z: 226, label: 'Get in the orange muscle car', sub: ['Marisol', 'The orange Marlowe by the boardwalk. Keys are in it.'] },
        { type: 'deliver', x: S.marina.x, z: S.marina.z, label: 'Drive to the Marina', sub: ['Marisol', 'Marina docks. Do not scratch the paint.'] }
      ] },
    { title: 'Neon Run', intro: 'Marisol: "A package. Neon Mile to Casino Row. The city is watching — move."',
      steps: [
        { type: 'goto', x: S.neon.x, z: S.neon.z, label: 'Pick up the package on Neon Mile', sub: ['Marisol', 'Courier waits by the pink billboard.'] },
        { type: 'deliver', x: S.casino.x, z: S.casino.z, label: 'Deliver to Casino Row', time: 150, sub: ['Marisol', 'Ninety seconds of fame. Clock is running.'] }
      ] },
    { title: 'Hot Cargo', intro: 'Marisol: "Customs flagged a van at the Port. Lift it before they inventory it."',
      steps: [
        { type: 'goto', x: S.port.x, z: S.port.z, label: 'Reach the Port warehouse', sub: ['Marisol', 'Grey van, bay three.'] },
        { type: 'deliver', x: S.oldtown.x, z: S.oldtown.z, label: 'Take the cargo to Old Town', heat: 2, sub: ['Marisol', 'Heat is on you. Lose them or outrun them — just arrive.'] }
      ] },
    { title: 'Tail Spin', intro: 'Marisol: "A rival courier thinks he is invisible. Follow him. Stay close, stay unseen."',
      steps: [
        { type: 'goto', x: S.neon.x, z: 40, label: 'Find the rival courier', sub: ['Marisol', 'Blue compact, Neon Mile north.'] },
        { type: 'tail', x: S.university.x, z: S.university.z, label: 'Tail him to the University', sub: ['Marisol', 'Close enough to read plates. Not close enough to spook him.'] }
      ] },
    { title: 'Marina Blues', intro: 'Marisol: "The Tide Runner at the marina. A buyer waits at the lighthouse island."',
      steps: [
        { type: 'goto', x: 208, z: 400, label: 'Board the Tide Runner speedboat', sub: ['Marisol', 'Red hull, tied at the south dock.'] },
        { type: 'deliver', x: S.island.x - 20, z: S.island.z + 40, label: 'Sail to the island rendezvous', boat: true, sub: ['Buyer', 'Island south shore. Mind the bridge pillars.'] }
      ] },
    { title: 'Escort Service', intro: 'Marisol: "A singer, a casino, a hundred cameras. Get her there in one piece."',
      steps: [
        { type: 'goto', x: S.casino.x, z: S.casino.z, label: 'Pick up the singer at the casino', sub: ['Marisol', 'She rides up front. Paparazzi ride everywhere else.'] },
        { type: 'escort', x: S.heights.x, z: S.heights.z, label: 'Escort her to Palm Heights', sub: ['Singer', 'Just drive smooth, handsome. And lose the vans.'] }
      ] },
    { title: 'Storm Chaser', intro: 'Marisol: "Storm rolling in. My courier is stranded — bring the meds across town."',
      steps: [
        { type: 'goto', x: S.university.x, z: S.university.z, label: 'Collect the meds at the University', weather: 'storm', sub: ['Marisol', 'Rain or not, people are waiting.'] },
        { type: 'deliver', x: S.marina.x, z: S.marina.z, label: 'Deliver to the Marina clinic boat', time: 170, weather: 'storm', sub: ['Marisol', 'Roads are slick. Drift smart.'] }
      ] },
    { title: 'The Getaway', intro: 'Marisol: "The casino job went loud. Car is hot, you are hotter. Lose the cops."',
      steps: [
        { type: 'goto', x: S.casino.x, z: 132, label: 'Reach the getaway car', heat: 4, sub: ['Marisol', 'Four stars, Jax. FOUR. Move!'] },
        { type: 'survive', label: 'Lose the cops!', loseHeat: true, sub: ['Marisol', 'Break line of sight. Alleys, beach, anywhere dark.'] }
      ] },
    { title: 'Rival Kings', intro: 'Marisol: "The Kings say their wheelman is faster. Prove the bay wrong — race them."',
      steps: [
        { type: 'goto', x: 2, z: 62, label: 'Reach the race start on Casino Row', sub: ['Marisol', 'Three Kings, one crown. Yours.'] },
        { type: 'race', label: 'Win the Casino Row street race', raceId: 0, sub: ['King', 'Try to keep up, Marlowe.'] }
      ] },
    { title: 'Port Authority', intro: 'Marisol: "Port security doubled. Sneak the sedan out through the checkpoint run."',
      steps: [
        { type: 'goto', x: S.port.x, z: 10, label: 'Enter the Port district', sub: ['Marisol', 'Slow is smooth. Smooth is invisible.'] },
        { type: 'deliver', x: S.neon.x, z: S.neon.z, label: 'Slip the sedan back to Neon Mile', heat: 3, sub: ['Marisol', 'They noticed. Forget invisible — be gone.'] }
      ] },
    { title: 'Skyline Siege', intro: 'Marisol: "They are coming for the safehouse. Hold the block for ninety seconds."',
      steps: [
        { type: 'goto', x: S.oldtown.x, z: S.oldtown.z, label: 'Reach the Old Town safehouse', sub: ['Marisol', 'Waves of rivals inbound. Stand your ground.'] },
        { type: 'survive', label: 'Survive the siege', time: 90, waves: true, sub: ['Marisol', 'Ninety seconds, Jax. Count them with me.'] }
      ] },
    { title: 'Neon Tide', intro: 'Marisol: "Last job. Everything we built, one night. Chase the Kings\u2019 boss, then vanish by sea."',
      steps: [
        { type: 'goto', x: S.fixer.x, z: S.fixer.z, label: 'Meet Marisol at the Boardwalk', sub: ['Marisol', 'Tonight we finish this.'] },
        { type: 'chase', x: S.port.x, z: S.port.z, label: 'Run down the Kings\u2019 boss', sub: ['Marisol', 'His gold muscle car. Stop it — any way you can.'] },
        { type: 'deliver', x: 208, z: 400, label: 'Get to the marina boat', heat: 3, sub: ['Marisol', 'Now the sea. The island, like we planned.'] },
        { type: 'deliver', x: S.island.x, z: S.island.z, label: 'Escape to the island', boat: true, sub: ['Marisol', 'Lighthouse light means freedom, Jax. Go.'] }
      ] }
  ]; }
  function makeMarker(x, z, colorHex) {
    var grp = new THREE.Group();
    var cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 26, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false }));
    cyl.position.y = 13; grp.add(cyl);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 8, 24), new THREE.MeshBasicMaterial({ color: colorHex }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4; grp.add(ring);
    grp.position.set(x, SH.city.groundY(x, z), z);
    return grp;
  }
  function init(scene) {
    buildStory();
    markerMesh = makeMarker(0, 0, 0xffd23f); markerMesh.visible = false; scene.add(markerMesh);
    storyMarker = makeMarker(S.fixer.x, S.fixer.z, 0xff4fd8); scene.add(storyMarker);
  }
  function currentDef() {
    var idx = SH.economy.data.missionIndex;
    return idx < STORY.length ? STORY[idx] : null;
  }
  function startNext() {
    var def = currentDef();
    if (!def || active) return false;
    startMission(def, SH.economy.data.missionIndex);
    return true;
  }
  function startMission(def, idx) {
    active = { def: def, idx: idx, step: 0, timer: 0, targetRec: null, tailT: 0, waveT: 0, done: false };
    storyMarker.visible = false;
    SH.hud.showBanner(def.title.toUpperCase(), def.intro);
    SH.hud.subtitle('Marisol Vega', def.intro.replace(/^Marisol: /, ''));
    if (def.steps[0].weather) SH.weather.setState(def.steps[0].weather);
    if (def.steps[0].heat) SH.police.setWanted(def.steps[0].heat);
    setupStep();
    SH.audio.click();
  }
  function setupStep() {
    var st = active.def.steps[active.step];
    active.timer = st.time || 0;
    active.targetRec = null;
    if (st.type === 'tail') spawnTailTarget(st);
    if (st.type === 'chase') spawnChaseTarget(st);
    if (st.type === 'escort') spawnEscort();
    if (st.type === 'race') { SH.sidejobs.startRace(st.raceId || 0, function (won) { if (won) completeStep(); else failMission('You lost the race.'); }); }
    if (st.heat && active.step > 0) SH.police.setWanted(st.heat);
    if (st.weather) SH.weather.setState(st.weather);
    if (st.sub) SH.hud.subtitle(st.sub[0], st.sub[1]);
    placeMarker(st);
  }
  function placeMarker(st) {
    if (st.type === 'survive' && st.loseHeat) { markerMesh.visible = false; return; }
    var x = st.x, z = st.z;
    if (active.targetRec) { x = active.targetRec.x; z = active.targetRec.z; }
    if (x === undefined) { markerMesh.visible = false; return; }
    markerMesh.position.set(x, SH.city.groundY(x, z), z);
    markerMesh.visible = true;
  }
  function spawnTailTarget(st) {
    var rec = SH.vehicles.makeCar('compact', S.neon.x, 30, 0, { color: 0x26547c });
    rec.ai.path = SH.city.findPath(rec.x, rec.z, st.x, st.z); rec.ai.pathI = 0;
    rec.ai.targetSpeed = 15; rec.traffic = false; rec.missionCar = true;
    SH.vehicles.traffic.push(rec);
    active.targetRec = rec;
  }
  function spawnChaseTarget(st) {
    var rec = SH.vehicles.makeCar('muscle', S.casino.x + 30, 120, 0, { color: 0xffd700 });
    rec.ai.path = SH.city.findPath(rec.x, rec.z, st.x, st.z); rec.ai.pathI = 0;
    rec.ai.targetSpeed = 34; rec.traffic = false; rec.missionCar = true; rec.fleeing = true;
    SH.vehicles.traffic.push(rec);
    active.targetRec = rec;
  }
  function spawnEscort() {
    var pd = SH.pedestrians.makePed(S.casino.x + 3, S.casino.z + 2);
    pd.state = 'follow'; active.escortPed = pd;
  }
  function failMission(why) {
    if (!active) return;
    SH.hud.showBanner('MISSION FAILED', why + ' Press E at the pink marker to retry.');
    SH.audio.fail();
    if (active.targetRec) active.targetRec.missionCar = false;
    active = null; markerMesh.visible = false;
    storyMarker.visible = true;
    SH.hud.setObjective('');
  }
  function completeStep() {
    active.step++;
    if (active.step >= active.def.steps.length) { completeMission(); return; }
    SH.audio.success();
    setupStep();
  }
  function completeMission() {
    var idx = active.idx;
    var pay = B.missionPay[idx] || 400, xp = B.missionXP[idx] || 60;
    SH.economy.data.stats.missionsDone++;
    SH.economy.data.missionIndex = idx + 1;
    SH.economy.addCash(pay, 'Mission: ' + active.def.title);
    SH.economy.addXP(xp);
    var pp = SH.player.pos();
    SH.effects.confettiAt(pp.x, 3, pp.z);
    SH.audio.success();
    if (idx + 1 >= STORY.length) SH.hud.showBanner('STORY COMPLETE', 'Jax Marlowe owns the Neon Tide. Free roam: jobs, races and collectibles remain.');
    else SH.hud.showBanner('MISSION COMPLETE', active.def.title + ' — +$' + pay + ' · +' + xp + ' XP. Next: ' + STORY[idx + 1].title);
    active = null; markerMesh.visible = false;
    storyMarker.visible = SH.economy.data.missionIndex < STORY.length;
    SH.hud.setObjective('');
    SH.economy.save();
  }
  function objectiveText() {
    if (!active) return '';
    var st = active.def.steps[active.step];
    var pp = SH.player.pos();
    var tx = st.x, tz = st.z;
    if (active.targetRec) { tx = active.targetRec.x; tz = active.targetRec.z; }
    var d = (tx !== undefined) ? Math.round(R.dist2(pp.x, pp.z, tx, tz)) + 'm' : '';
    var extra = '';
    if (active.timer > 0) extra = ' · ' + Math.ceil(active.timer) + 's';
    if (st.type === 'survive' && st.loseHeat) extra = ' · Wanted: ' + SH.police.wanted + ' stars';
    return active.def.title + ': ' + st.label + (d ? ' (' + d + ')' : '') + extra;
  }
  function markerPos() {
    if (!active) return null;
    if (markerMesh.visible) return { x: markerMesh.position.x, z: markerMesh.position.z };
    if (active.targetRec) return { x: active.targetRec.x, z: active.targetRec.z };
    return null;
  }
  function update(dt) {
    // onboarding guidance
    if (SH.economy.data.onboarding < 3 && !active) runOnboarding();
    if (storyMarker) {
      storyMarker.rotation.y += dt;
      storyMarker.visible = !active && SH.economy.data.missionIndex < STORY.length;
      var pp0 = SH.player.pos();
      if (!active && storyMarker.visible && R.dist2(pp0.x, pp0.z, S.fixer.x, S.fixer.z) < 4) {
        SH.hud.setPrompt('Press E — start mission: ' + (currentDef() ? currentDef().title : ''));
        if (SH.input.interactPressed()) startNext();
      }
    }
    if (!active) return;
    var st = active.def.steps[active.step];
    var pp = SH.player.pos();
    if (active.timer > 0 && !(st.type === 'survive' && st.waves)) {
      active.timer -= dt;
      if (active.timer <= 0) { failMission('Out of time.'); return; }
    }
    if (markerMesh.visible) markerMesh.rotation.y += dt * 1.4;
    switch (st.type) {
      case 'goto': case 'deliver':
        if (st.boat && !SH.player.data.inBoat) { /* must arrive by boat: checked below */ }
        if (R.dist2(pp.x, pp.z, st.x, st.z) < (st.boat ? 16 : 6)) {
          if (st.boat && !SH.player.data.inBoat) { SH.hud.setPrompt('You need the speedboat for this leg'); break; }
          completeStep();
        }
        break;
      case 'tail': {
        var t = active.targetRec;
        if (!t) { completeStep(); break; }
        placeMarker(st);
        var d = R.dist2(pp.x, pp.z, t.x, t.z);
        if (d < 7) { active.tailT += dt; if (active.tailT > 2.5) { failMission('Spotted! You got too close for too long.'); return; } }
        else active.tailT = Math.max(0, active.tailT - dt);
        if (d > 85) { failMission('You lost the tail.'); return; }
        if (R.dist2(t.x, t.z, st.x, st.z) < 12) completeStep();
        break;
      }
      case 'chase': {
        var c = active.targetRec;
        if (!c) { completeStep(); break; }
        placeMarker(st);
        if (c.damage >= 85 || Math.abs(c.speed) < 1 && R.dist2(pp.x, pp.z, c.x, c.z) < 8) completeStep();
        break;
      }
      case 'escort': {
        var ped = active.escortPed;
        if (ped && !SH.player.currentVehicle()) { ped.state = 'follow'; }
        if (R.dist2(pp.x, pp.z, st.x, st.z) < 7) completeStep();
        break;
      }
      case 'survive': {
        if (st.loseHeat) { if (SH.police.wanted === 0) completeStep(); break; }
        if (st.waves) {
          active.waveT -= dt;
          if (active.waveT <= 0) { active.waveT = 16; spawnWave(); }
          active.timer -= dt;
          SH.hud.setObjective(active.def.title + ': Survive the siege · ' + Math.ceil(active.timer) + 's');
          if (active.timer <= 0) completeStep();
        }
        break;
      }
      case 'race': break; // handled by sidejobs callback
    }
    SH.hud.setObjective(objectiveText());
  }
  var waveCount = 0;
  function spawnWave() {
    waveCount++;
    var pp = SH.player.pos();
    for (var i = 0; i < 2; i++) {
      var pd = SH.pedestrians.makePed(pp.x + R.range(-26, 26), pp.z + R.range(-26, 26));
      pd.state = 'flee'; pd.panic = 0.5; pd.hostile = true;
    }
    var rec = SH.vehicles.makeCar('muscle', pp.x + R.range(-40, 40), pp.z + R.range(-40, 40), 0, {});
    rec.copAI = { mode: 'pursue' }; // reuse pursuit steering via police-style record flag
    rec.hostile = true;
    SH.hud.toast('Rival wave ' + waveCount + ' inbound!');
  }
  // ---- Onboarding: 3 guided steps at game start
  var ONBOARD = [
    { text: 'Welcome to Solstice Bay, Jax. Walk with WASD — head to the orange car.', check: function (pp) { return R.dist2(pp.x, pp.z, -46, 226) < 7; } },
    { text: 'Press E to get in. Drive with WASD, Space to drift.', check: function () { return !!SH.player.currentVehicle(); } },
    { text: 'Drive to the pink marker — Marisol Vega is waiting. E starts the job.', check: function () { return SH.economy.data.onboarding >= 3; } }
  ];
  function runOnboarding() {
    var step = ONBOARD[onboardStep];
    if (!step) { SH.economy.data.onboarding = 3; return; }
    SH.hud.setObjective('Getting Started ' + (onboardStep + 1) + '/3: ' + step.text);
    var pp = SH.player.pos();
    if (onboardStep === 2) {
      if (R.dist2(pp.x, pp.z, S.fixer.x, S.fixer.z) < 5) { onboardStep = 3; SH.economy.data.onboarding = 3; SH.economy.save(); SH.hud.toast('Onboarding complete — talk to Marisol (E)'); return; }
    } else if (step.check(pp)) { onboardStep++; SH.audio.pickup(); }
  }
  return {
    init: init, update: update, startNext: startNext, failMission: failMission,
    isActive: function () { return !!active; }, activeDef: function () { return active ? active.def : null; },
    markerPos: markerPos, story: STORY, storyMarkerPos: function () { return S.fixer; }
  };
})();
