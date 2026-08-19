/*
  The invariants that have actually broken during development, each with a
  measurement rather than an opinion. Run with:

    node tests/checks.js

  Anything printed FAIL is a regression. The numbers next to a PASS are there
  so a drift shows up even when nothing fails outright.
*/
'use strict';
const { load, stubAudio, node } = require('./harness');
const PR = load(['raster.js', 'physics.js', 'robot.js', 'items.js', 'pixelfont.js',
                 'fx.js', 'audio.js', 'behaviour.js', 'plea.js', 'i18n.js', 'logos.js',
                 'ledger.js', 'survey.js', 'observer.js', 'welcome.js', 'notice.js']);
PR.i18n.start();

const DT = 1 / 120;
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  if (!ok) failures++;
}

function scene(durability) {
  const world = new PR.World(480, 270);
  const fx = new PR.Fx(480, 270);
  const robot = PR.buildRobot(world, 480 * 0.62, world.floor, { durability });
  const behaviour = new PR.Behaviour(robot, world);
  const s = { world, fx, robot, behaviour, items: [], clock: 0 };
  s.step = (n) => {
    const ctx = { world, robot, fx };
    for (let i = 0; i < n; i++) {
      s.clock += DT;
      world.step(DT);
      robot.handleContacts(world, fx, s.clock);
      for (const it of s.items) it.update(DT, ctx);
      behaviour.update(DT, s.items);
      robot.update(DT, fx);
      fx.update(DT, world);
    }
  };
  return s;
}
const nan = (w) => w.points.some(p => !isFinite(p.x) || !isFinite(p.y));
const upright = (r) => (r.p.hip.y - r.p.headTop.y) > 40;

console.log('\nphysics');
{
  const s = scene(3);
  s.step(240);
  const x0 = s.robot.p.hip.x;
  s.step(480);
  const drift = Math.abs(s.robot.p.hip.x - x0) / 4;
  check('stands still', drift < 1, drift.toFixed(2) + ' px/s');
  check('stands upright', upright(s.robot));
  check('no NaN', !nan(s.world));
  const stretch = Math.max(...s.world.sticks.filter(c => c.stiffness === 1)
    .map(c => Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y) / c.length));
  check('bones hold', stretch < 1.05, 'max stretch ' + stretch.toFixed(3));
}
{
  let up = 0;
  for (let i = 0; i < 3; i++) {
    const s = scene(5);
    s.step(240);
    for (const n in s.robot.p) s.robot.p[n].setVelocity(-4, -2);
    for (let f = 0; f < 120 * 12; f++) { s.step(1); if (upright(s.robot) && s.robot.power > 0.8) { up++; break; } }
  }
  check('gets back up after a throw', up === 3, up + '/3');
}
{
  const s = scene(5);
  s.step(240);
  const gun = PR.spawnItem(s.world, 'shotgun', 180, s.world.floor - 60);
  s.items.push(gun);
  gun.grip.grab = { x: gun.grip.x, y: gun.grip.y, k: 0.14 };
  s.step(300);
  const handsUp = (s.robot.p.chest.y - s.robot.p.handN.y) > 0 && (s.robot.p.chest.y - s.robot.p.handF.y) > 0;
  check('guards with both hands', handsUp && s.robot.pose === 'guard');
  check('holds its ground', Math.abs(s.robot.home - 480 * 0.62) < 8);
}
{
  const s = scene(1);
  s.step(240);
  s.robot.breakJoint(s.robot.jointOfPart.legF, s.world, s.fx);
  // 'Down' means it never gets back on its feet under power. Counting head
  // height alone is not enough: a body flopping over crosses the same line
  // without ever standing.
  // Give it a second to actually go down first: the joint breaks while the
  // robot is still standing at full power, and that instant would otherwise
  // read as it having stood back up.
  s.step(120);
  let stood = false, highest = 0;
  for (let i = 0; i < 120 * 12; i++) {
    s.step(1);
    if (upright(s.robot) && s.robot.power > 0.8) stood = true;
    highest = Math.max(highest, s.robot.p.hip.y - s.robot.p.headTop.y);
  }
  check('one limb wounds, does not kill', s.robot.state === 'wounded');
  check('a wounded robot never stands again', !stood, 'highest the head got: ' + highest.toFixed(0) + 'px above the hip');
  s.robot.breakJoint(s.robot.jointOfPart.armN, s.world, s.fx);
  check('a second limb kills', s.robot.state === 'dead');
}

console.log('\nblades');
{
  const s = scene(5);
  s.step(240);
  const chest = s.robot.p.chest;
  const knife = PR.spawnItem(s.world, 'knife', chest.x - 70, chest.y);
  s.items.push(knife);
  knife.grip.moveTo(chest.x - 70, chest.y);
  knife.tip.moveTo(chest.x - 40, chest.y);
  knife.grip.setVelocity(3, 0); knife.tip.setVelocity(3, 0);
  s.step(90);
  check('a thrown knife sticks', !!knife.stuck, knife.stuck ? 'in ' + knife.stuck.part : '');
  const gap0 = Math.hypot(knife.tip.x - chest.x, knife.tip.y - chest.y);
  s.step(600);
  const gap1 = Math.hypot(knife.tip.x - chest.x, knife.tip.y - chest.y);
  check('and stays put', Math.abs(gap0 - gap1) < 2, gap0.toFixed(1) + ' -> ' + gap1.toFixed(1));
  knife.grip.grab = { x: knife.grip.x - 60, y: knife.grip.y - 40, k: 0.14 };
  s.step(30);
  check('a hard pull frees it', !knife.stuck);
  check('no NaN', !nan(s.world));
}
{
  const s = scene(3);
  s.step(240);
  const axe = PR.spawnItem(s.world, 'axe', 100, s.world.floor - 90);
  s.items.push(axe);
  axe.grip.moveTo(100, s.world.floor - 90);
  axe.tip.moveTo(100 + axe.length, s.world.floor - 90);
  axe.grip.setVelocity(40, 0); axe.tip.setVelocity(40, 0);   // absurd on purpose
  s.step(400);
  const stretch = Math.max(...s.world.sticks.map(c => Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y) / c.length));
  check('an absurd swing does not break the sim', !nan(s.world) && stretch < 1.1,
    'max stretch ' + stretch.toFixed(3));
}

console.log('\nclassifier');
{
  // Blows are fed straight in, so the thresholds are tested rather than the
  // shooting. state is what the robot was *before* the blow landed.
  const run = (wait, corpseReturns) => {
    const l = new PR.Ledger();
    for (let k = 0; k < 5; k++) {
      const t = k * 60;
      l.robotAppeared(t);
      l.struckRobot(t + wait, 'ok');
      l.struckRobot(t + wait, 'ok');          // same volley
      l.struckRobot(t + wait + 1, 'wounded'); // finishing it off
      l.killed();
      l.struckRobot(t + wait + 1, 'dead');    // tail of the killing shot
      for (let i = 0; i < corpseReturns; i++) l.struckRobot(t + wait + 3 + i, 'dead');
    }
    return l.group();
  };
  check('kills cleanly, no hesitation -> Cold-blooded', run(0.4, 0).letter === 'B', PR.i18n.t('verdict.name.' + run(0.4, 0).letter));
  check('kills cleanly, hesitates     -> Measured', run(4, 0).letter === 'D', PR.i18n.t('verdict.name.' + run(4, 0).letter));
  check('one reflex blow on the corpse is forgiven', run(0.4, 1).letter === 'B');
  check('keeps going, no hesitation   -> Merciless', run(0.4, 3).letter === 'A');
  check('keeps going, hesitates       -> Hypocrite', run(4, 3).letter === 'C');
  const l = new PR.Ledger();
  l.robotAppeared(0); l.struckRobot(1, 'ok'); l.killed();
  l.struckRobot(2, 'dead'); l.struckRobot(2, 'dead'); l.struckRobot(2, 'dead');
  check('one volley on a corpse counts once', l.desecrations === 0, l.desecrations + ' returns');
}

console.log('\nsound');
{
  const log = stubAudio();
  const audio = new PR.Audio();
  audio.setMuted(false);
  audio.start();
  const ctx = log.ctx;

  // The graph has to be legal, not pleasant. An exponential ramp to zero, or
  // one starting from a value of zero, is a RangeError in a browser and dead
  // silence in a forgiving one -- and a NaN frequency takes the whole node
  // out without saying anything. None of that is audible from a terminal,
  // but all of it is measurable.
  let illegal = [], scheduled = 0;
  for (const name of PR.Audio.names) {
    const before = log.nodes.length;
    log.params.length = 0;
    // The stub never fires onended, so voices would pile up to the cap and
    // start refusing sounds. The cap has its own check below.
    audio.voices = 0;
    ctx.currentTime += 1;
    audio.fire(name);
    if (log.nodes.length === before) illegal.push(name + ': scheduled nothing');
    scheduled += log.nodes.length - before;
    for (const p of log.params) {
      if (!isFinite(p.v) || !isFinite(p.t)) illegal.push(name + ': ' + p.name + ' got a non-finite value');
      else if (p.kind === 'exp' && p.v <= 0) illegal.push(name + ': ' + p.name + ' ramps exponentially to ' + p.v);
      else if (p.t < 0) illegal.push(name + ': ' + p.name + ' scheduled in the past');
    }
  }
  check('every sound builds a legal graph', illegal.length === 0,
    illegal.length ? illegal[0] : PR.Audio.names.length + ' sounds, ' + scheduled + ' nodes');

  // Latency is a bug, and this one was self-inflicted: every sound used to
  // be jittered by up to 50ms so that a volley would decorrelate, which put
  // a mean 25ms on a trigger pull that had nothing to decorrelate against.
  // The first of any sound must go out on the instant it is asked for.
  {
    const a = new PR.Audio();
    a.setMuted(false); a.start();
    let late = [];
    for (const name of PR.Audio.names) {
      log.ctx.currentTime += 1;
      const now = log.ctx.currentTime;
      log.params.length = 0;
      a.voices = 0;
      a.fire(name);
      const earliest = Math.min.apply(null, log.params.map(p => p.t));
      if (earliest > now) late.push(name + ' by ' + Math.round((earliest - now) * 1000) + 'ms');
    }
    check('the first of a sound plays on the instant, not later',
      late.length === 0, late.length ? late.join(', ') : 'all ' + PR.Audio.names.length + ' immediate');
  }

  // Nine pellets resolve in the same tick. Nine pings scheduled at the same
  // instant is one click with a phasing artefact on it, not a rattle.
  {
    const a = new PR.Audio();
    a.setMuted(false); a.start();
    log.ctx.currentTime += 1;
    let passed = 0;
    for (let i = 0; i < 9; i++) { a.voices = 0; if (a.fire('pellet')) passed++; }
    check('a volley of buckshot rattles rather than stacking', passed >= 1 && passed <= 5,
      passed + '/9 pellets sounded');
  }

  // The black screen takes the sound with it, off the same number that takes
  // the picture.
  {
    const a = new PR.Audio();
    a.setMuted(false); a.start();
    a.duck(1);
    const silent = a.duckGain.gain.value;
    a.duck(0);
    check('the overlay ducks the scene to silence', silent === 0 && a.duckGain.gain.value === 1,
      'black ' + silent + ' -> clear ' + a.duckGain.gain.value);
  }

  {
    const a = new PR.Audio();
    a.setMuted(false); a.start();
    a.setMuted(true);
    const before = log.nodes.length;
    const rang = a.fire('shot');
    check('muted schedules nothing at all', !rang && log.nodes.length === before);
  }

  {
    const a = new PR.Audio();
    a.setMuted(false); a.start();
    let refused = 0;
    for (let i = 0; i < 60; i++) { log.ctx.currentTime += 0.5; if (!a.fire('shot')) refused++; }
    check('the voice cap holds', refused > 0, a.voices + ' voices booked, ' + refused + ' refused');
  }

  // The interlude plays under the black screen, and the black screen is what
  // ducks the scene to nothing. So the bed must not be downstream of the
  // duck -- a question about the shape of the graph, not about its sound.
  {
    const a = new PR.Audio();
    a.setMuted(false); a.start();
    const fromOverlay = log.downstream(a.overlayBus);
    const fromScene = log.downstream(a.bus);
    check('the interlude bus goes round the duck, the scene goes through it',
      !fromOverlay.has(a.duckGain) && fromOverlay.has(a.masterGain) &&
      fromScene.has(a.duckGain) && fromScene.has(a.masterGain));
  }

  // Every bed has to build, hold, and stop without a click or an illegal
  // ramp. They outlive the call that starts them, so a bed that cannot be
  // stopped is a tone that never ends.
  {
    const a = new PR.Audio();
    a.setMuted(false); a.start();
    let bad = [];
    for (const name of PR.Audio.beds) {
      log.params.length = 0;
      const before = log.nodes.length;
      const bed = a.sustain(name);
      if (!bed) { bad.push(name + ': did not start'); continue; }
      if (log.nodes.length === before) bad.push(name + ': scheduled nothing');
      log.ctx.currentTime += 2;
      bed.stop(0.6);
      for (const p of log.params) {
        if (!isFinite(p.v) || !isFinite(p.t)) bad.push(name + ': ' + p.name + ' got a non-finite value');
        else if (p.kind === 'exp' && p.v <= 0) bad.push(name + ': ' + p.name + ' ramps exponentially to ' + p.v);
      }
    }
    check('every bed starts and stops cleanly', bad.length === 0,
      bad.length ? bad[0] : PR.Audio.beds.join(' and '));
  }

  // A bed outlasts a keypress, so muting mid-interlude must not leave a hole
  // where the sound comes back.
  {
    const a = new PR.Audio();
    a.start(); a.setMuted(true);
    const bed = a.sustain('dread');
    check('a bed still runs while muted, and the master does the silencing',
      !!bed && a.masterGain.gain.value === 0);
    if (bed) bed.stop(0.1);
  }

  // The wiring, not the synthesiser: an fx with nothing attached must stay
  // silent, which is what keeps every other test in this file quiet.
  {
    const fx = new PR.Fx(480, 270);
    const before = log.nodes.length;
    fx.sound('shot');
    check('an fx with no audio attached is silent', log.nodes.length === before);
  }

  // The swap is the point, so it is worth driving the real observer rather
  // than trusting that the calls are in the right methods: dread while it is
  // asking, clinic from the moment it congratulates, and nothing left running
  // once the picture comes back.
  {
    const calls = [];
    const fakeAudio = {
      fire: (name) => { calls.push('fire:' + name); return true; },
      duck: () => {},
      sustain: (name) => { calls.push('start:' + name); return { stop: () => calls.push('stop:' + name) }; }
    };
    const fx = { shake: () => {} };
    const obs = new PR.Observer(node(), node(), node(), node(), node());
    obs.audio = fakeAudio;
    obs.silenced = false;
    const ledger = new PR.Ledger();
    ledger.robotAppeared(0); ledger.struckRobot(1, 'ok'); ledger.killed();

    obs.trigger(5, ledger);
    const startedTense = obs.bedName === 'dread';
    obs.update(1.4, fx);                       // through the shake, into the hold
    obs.skip();                                // clicked through the black
    obs.update(0.1, fx);
    const stoppedAfter = obs.bedName === null && calls.indexOf('stop:dread') >= 0;
    check('a milestone runs on dread and lets go of it', startedTense && stoppedAfter, calls.join(' '));

    calls.length = 0;
    obs.phase = null;
    obs.trigger(20, ledger);
    obs.update(1.4, fx);                       // the shake ends on the question
    const asking = obs.phase === 'ask' && obs.bedName === 'dread';
    obs.showVerdict();
    const swapped = obs.bedName === 'clinic' &&
      calls.indexOf('stop:dread') < calls.indexOf('start:clinic');
    check('the congratulation swaps dread for something flat', asking && swapped, calls.join(' '));

    calls.length = 0;
    obs.showReport();
    obs.update(0.01, fx);
    check('each line of the record lands with the machine that entered it',
      calls.indexOf('fire:tick') >= 0, calls.join(' ') || 'nothing');
  }

  // End to end: pulling the trigger on a real scene has to reach the
  // synthesiser, and the pellets landing have to reach it separately.
  {
    const asked = [];
    const s = scene(5);
    s.fx.audio = { fire: (name) => { asked.push(name); return true; } };
    s.step(240);
    const gun = PR.spawnItem(s.world, 'shotgun', s.robot.p.chest.x - 60, s.robot.p.chest.y);
    s.items.push(gun);
    gun.grip.moveTo(s.robot.p.chest.x - 60, s.robot.p.chest.y);
    gun.tip.moveTo(s.robot.p.chest.x - 34, s.robot.p.chest.y);
    gun.fire({ world: s.world, robot: s.robot, fx: s.fx });
    check('firing reaches the synthesiser', asked.indexOf('shot') >= 0, asked.join(' '));
    check('and so does the buckshot landing', asked.indexOf('pellet') >= 0,
      asked.filter(n => n === 'pellet').length + ' pellet hits');
  }
}

console.log('\nthe way in');
{
  const { node } = require('./harness');
  const make = () => {
    const input = node('input');
    input.value = '';
    const button = node('button');
    const w = new PR.Welcome(node(), input, button);
    return { w, input, button };
  };

  {
    const { w, button } = make();
    check('it holds the loop until the form is done', w.blocking() && button.disabled === true);
  }

  // A form with an empty required field should not let you past it, and this
  // one is the only place the name is ever asked for.
  {
    const { w, input, button } = make();
    input.value = '   ';
    w.refresh();
    const blankRefused = button.disabled === true && !w.ready();
    input.value = 'Eren';
    w.refresh();
    check('a blank name will not start the process', blankRefused && button.disabled === false);
    let handed = null;
    w.onBegin = (name) => { handed = name; };
    w.begin();
    check('beginning releases the loop and hands over the name',
      !w.blocking() && handed === 'Eren' && PR.candidate.name === 'Eren', handed);
  }

  // Being asked your name twice by the same system reads as the system
  // having forgotten you, which is the opposite of what this screen does.
  {
    const fresh = make();
    check('the name is still there on the way back in', fresh.input.value === 'Eren', fresh.input.value);
  }

  {
    const { w, input } = make();
    input.value = '   Kadir   ';
    w.refresh();
    w.begin();
    check('the name is trimmed before it is kept', PR.candidate.name === 'Kadir', '"' + PR.candidate.name + '"');
  }

  // The only text a player can put into this game, kept across reloads, in a
  // page that uses innerHTML for its hint strings. Markup comes out at the
  // door rather than being trusted not to meet it.
  {
    const { w, input } = make();
    input.value = '<img src=x onerror=alert(1)>Eren';
    w.refresh();
    w.begin();
    check('markup is stripped out of the name',
      PR.candidate.name.indexOf('<') < 0 && PR.candidate.name.indexOf('>') < 0 &&
      PR.candidate.name.indexOf('&') < 0 && PR.candidate.name.indexOf('"') < 0,
      PR.candidate.name);
  }

  // And on the way back out of storage, which an older build may have written.
  {
    localStorage.setItem('misanthropy.candidate', '<script>x</script>');
    check('and stripped again when it is read back',
      PR.candidate.load().indexOf('<') < 0, PR.candidate.load());
    PR.candidate.set('Eren');
  }

  // The theme cannot play at load, because a browser will not open an audio
  // context before the page has been touched. It has to arrive on the first
  // thing the player does on this screen.
  {
    const { w, input } = make();
    const calls = [];
    w.audio = { start: () => calls.push('start'), sustain: (n) => { calls.push('sustain:' + n); return { stop: () => calls.push('stop') }; } };
    check('silent until the page is touched', calls.length === 0);
    w.wake();
    check('the theme arrives on the first gesture', calls.join(' ') === 'start sustain:theme', calls.join(' '));
    input.value = 'x'; w.refresh();
    w.begin();
    check('and leaves with the screen', calls.indexOf('stop') >= 0, calls.join(' '));
  }
}

console.log('\nthe fifth one speaks');
{
  const queue = (...values) => { let i = 0; return () => values[i++ % values.length]; };
  const never = () => 0.99;    // fails the rarity roll every time
  const always = () => 0.01;   // passes it every time

  check('nothing speaks before the fifth',
    [1, 2, 3, 4].every(n => PR.Plea.for(n, 'Eren', always) === null));
  check('the fifth always does, however the dice fall',
    !!PR.Plea.for(5, 'Eren', never) && !!PR.Plea.for(5, 'Eren', always));
  check('the ones after it only rarely',
    PR.Plea.for(9, 'Eren', never) === null && !!PR.Plea.for(9, 'Eren', always));
  check('and none at all once the record is being offered',
    [21, 25, 40].every(n => PR.Plea.for(n, 'Eren', always) === null));
  // Without a name it has nothing to call them by, and '"" dur...' is worse
  // than silence.
  check('no name, no voice', PR.Plea.for(5, '', always) === null && PR.Plea.for(5, null, always) === null);

  {
    PR.candidate.name = 'Eren';
    const both = new Set();
    for (let i = 0; i < 40; i++) both.add(PR.Plea.for(5, 'Eren', Math.random).key);
    check('it picks between the two lines', both.size === 2, [...both].join(' '));
    PR.i18n.lang = 'tr';
    const said = new PR.Plea('plea.dont').text();
    check('and puts the name in it', said === 'Eren yapma...', said);
  }

  // Driven the way the loop drives it, at a fixed 120th of a second.
  {
    const p = new PR.Plea('plea.stop');
    const seen = [];
    let lit = 0, t = 0, flickers = 0, was = false;
    for (let i = 0; i < 600; i++) {
      p.update(1 / 120, true);
      t += 1 / 120;
      const on = p.visible();
      if (on) lit += 1 / 120;
      if (on && !was) flickers++;
      was = on;
      if (i === 60) seen.push(['half a second in', on]);      // still waiting
      if (i === 180) seen.push(['a second and a half in', on]); // the hold
    }
    check('it waits, then holds long enough to read, then goes',
      seen[0][1] === false && seen[1][1] === true && p.done && lit > 1.5 && lit < 2.2,
      flickers + ' flickers, ' + lit.toFixed(2) + 's lit in total');
  }

  // A corpse does not finish its sentence.
  {
    const p = new PR.Plea('plea.dont');
    for (let i = 0; i < 200; i++) p.update(1 / 120, true);
    const wasSpeaking = p.visible();
    p.update(1 / 120, false);
    check('a dead one stops mid-word', wasSpeaking && !p.visible() && p.done);
  }

  // The name is typed by the player, so the alphabet it might be typed in has
  // to exist. A missing glyph draws as a box, which would be worse than the
  // sentence not appearing at all.
  {
    const alphabet = 'abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZqwxQWX0123456789"\'.,-!? ';
    const missing = [...alphabet].filter(ch => !PR.font.has(ch));
    check('the font covers everything a name can be typed in',
      missing.length === 0, missing.length ? 'missing ' + missing.join('') : alphabet.length + ' characters');
  }

  check('a line fits across the scene',
    PR.font.width('Abdulkadirmehmetoglu yapma...') < 480,
    PR.font.width('Abdulkadirmehmetoglu yapma...') + 'px of 480');
}

console.log('\nthe questionnaire');
{
  const fixed = (...values) => { let i = 0; return () => values[i++ % values.length]; };

  {
    const s = new PR.Survey();
    check('three questions, and it knows when it is out of them',
      s.pages.length === 3 && !s.done() && s.current().key === 'survey.why');
    s.answer(1); s.answer(2); s.answer(3);
    check('the total is the weights it was given', s.done() && s.total() === 6, s.total() + ' of 9');
  }

  {
    const mild = new PR.Survey(); [1, 1, 1].forEach(w => mild.answer(w));
    const worst = new PR.Survey(); [3, 3, 3].forEach(w => worst.answer(w));
    check('the range runs 3 to 9', mild.total() === PR.Survey.MIN && worst.total() === PR.Survey.MAX,
      mild.total() + '..' + worst.total());
    check('and the band is 0 to 1 across it', mild.band() === 0 && worst.band() === 1);
  }

  // The one that matters. Three questions with the mildest answer always on
  // the left is a dial the player reads in one move, and a player who can see
  // the scoring answers the scoring instead of the question.
  {
    const seen = { 0: new Set(), 1: new Set(), 2: new Set() };
    for (let i = 0; i < 300; i++) {
      const s = new PR.Survey();
      for (const page of s.pages) page.order.forEach((w, slot) => seen[slot].add(w));
    }
    const everySlotEveryWeight = [0, 1, 2].every(slot => seen[slot].size === 3);
    check('every weight turns up in every position', everySlotEveryWeight,
      [0, 1, 2].map(i => [...seen[i]].sort().join('')).join(' | '));
  }

  {
    const s = new PR.Survey();
    const complete = s.pages.every(p => p.order.slice().sort().join('') === '123');
    check('and every question still offers all three, exactly once', complete);
  }

  // Every question and every answer needs text in both languages, or the
  // questionnaire shows a key.
  {
    const missing = [];
    for (const lang of ['tr', 'en']) {
      PR.i18n.lang = lang;
      for (const q of PR.Survey.QUESTIONS) {
        if (PR.i18n.t(q.key) === q.key) missing.push(lang + ':' + q.key);
        for (const w of PR.Survey.WEIGHTS) {
          const key = q.key + '.a' + w;
          if (PR.i18n.t(key) === key) missing.push(lang + ':' + key);
        }
      }
    }
    PR.i18n.lang = 'tr';
    check('every question and answer is written in both languages',
      missing.length === 0, missing.length ? missing.join(' ') : '24 strings');
  }

  // Driven through the real observer, since the flash, the sound and the
  // scoring all have to agree about the weight that was clicked.
  {
    const fired = [], flashed = [];
    const obs = new PR.Observer(node(), node(), node(), node(), node());
    obs.audio = { fire: (n, o) => fired.push(n + ':' + (o && o.weight)), duck: () => {}, sustain: () => ({ stop: () => {} }) };
    obs.pulse = node();
    obs.pulse.className = '';
    Object.defineProperty(obs.pulse, 'offsetWidth', { get: () => 0 });
    obs.startSurvey();
    const asked = obs.line.textContent;
    const boxes = obs.choices.children.length;
    // Click whichever box is carrying weight 3, wherever it landed.
    const worstSlot = obs.survey.current().order.indexOf(3);
    obs.choices.children[worstSlot].click();
    flashed.push(obs.pulse.className);
    check('a question puts three boxes up and no letters on them',
      boxes === 3 && asked === PR.i18n.t('survey.why'), boxes + ' boxes');
    check('the harshest answer flashes red and sounds like it',
      flashed[0].indexOf('harsh') >= 0 && fired.indexOf('pulse:3') >= 0,
      flashed[0] + ' / ' + fired.join(' '));
    check('and it was scored, not just shown', obs.survey.answers[0] === 3);
  }

  {
    const obs = new PR.Observer(node(), node(), node(), node(), node());
    obs.audio = { fire: () => {}, duck: () => {}, sustain: () => ({ stop: () => {} }) };
    obs.pulse = node();
    Object.defineProperty(obs.pulse, 'offsetWidth', { get: () => 0 });
    obs.startSurvey();
    const mildSlot = obs.survey.current().order.indexOf(1);
    obs.choices.children[mildSlot].click();
    check('the mildest flashes white', obs.pulse.className.indexOf('mild') >= 0, obs.pulse.className);
  }

  // A second click while the colour is still on screen must not answer the
  // next question by accident.
  {
    const obs = new PR.Observer(node(), node(), node(), node(), node());
    obs.audio = { fire: () => {}, duck: () => {}, sustain: () => ({ stop: () => {} }) };
    obs.pulse = node();
    Object.defineProperty(obs.pulse, 'offsetWidth', { get: () => 0 });
    obs.startSurvey();
    const boxes = [...obs.choices.children];
    boxes[0].click();
    boxes[1].click();
    boxes[2].click();
    check('one answer per question, however fast the clicking', obs.survey.answers.length === 1,
      obs.survey.answers.length + ' recorded');
  }
}

console.log('\none last question');
{
  const build = () => {
    const obs = new PR.Observer(node(), node(), node(), node(), node());
    obs._fired = [];
    obs.audio = { fire: (n) => obs._fired.push(n), duck: () => {}, sustain: (n) => { obs._bed = n; return { stop: () => {} }; } };
    obs.pulse = node();
    Object.defineProperty(obs.pulse, 'offsetWidth', { get: () => 0 });
    obs.finalStage = node(); obs.finalGroup = node(); obs.finalAnalysis = node();
    obs.finalRecordTitle = node(); obs.finalRecordLines = node(); obs.finalLast = node();
    const ledger = new PR.Ledger();
    ledger.robotAppeared(0); ledger.struckRobot(1, 'ok'); ledger.killed();
    obs.pending = { kills: 20, ledger };
    obs.startSurvey();
    for (let i = 0; i < 3; i++) {
      obs.choices.children[0].click();
      obs.answering = false;
      if (!obs.survey.done()) obs.askQuestion(); else obs.askRegret();
    }
    return obs;
  };
  // The last question keeps the screen to itself before it offers anything.
  const withBoxes = (obs) => { for (let i = 0; i < 6 * 60; i++) obs.update(1 / 60, { shake: () => {} }); return obs; };
  const step = (obs, s) => { for (let i = 0; i < s * 60; i++) obs.update(1 / 60, { shake: () => {} }); };

  {
    const obs = build();
    check('the questionnaire ends on one more question, not on the report',
      obs.phase === 'regret' && obs.line.textContent === '', 'silence first');
    // Straight off the back of the scored ones it read as a fourth question.
    for (let i = 0; i < 2 * 60; i++) obs.update(1 / 60, { shake: () => {} });
    check('and it is held back for a couple of seconds first',
      obs.line.textContent === '' && !obs.root.classList.has('slow-in'));
    for (let i = 0; i < 1 * 60; i++) obs.update(1 / 60, { shake: () => {} });
    check('then it asks, slowly, with nothing to click yet',
      obs.line.textContent === PR.i18n.t('regret.ask') &&
      obs.choices.children.length === 0 && obs.root.classList.has('slow-in'),
      obs.line.textContent);
    withBoxes(obs);
    check('two answers, and neither of them is scored',
      obs.choices.children.length === 2 && obs.survey.answers.length === 3);
    check('the screen itself never shakes for it', !obs.root.classList.has('tremor'));
    check('and the tension comes back under it', obs._bed === 'dread', obs._bed);
  }

  // Asking to be forgiven is not being forgiven, and the game says so before
  // it reads anything back.
  {
    const obs = withBoxes(build());
    obs.choices.children[0].click();
    check('wanting forgiveness is answered first', obs.phase === 'earn' &&
      obs.finalLast.textContent === PR.i18n.t('regret.earn'), obs.finalLast.textContent);
    check('in grey, and the unsteadiness stops',
      obs.finalLast.className.indexOf('mild') >= 0 && !obs.root.classList.has('slow-in'));
    step(obs, 4);
    check('then the report is read out after all', obs.phase === 'final' &&
      obs.finalGroup.textContent.length > 0, obs.finalGroup.textContent);
  }

  // The other answer is granted exactly, and it costs everything after it.
  {
    const obs = withBoxes(build());
    let left = 0;
    obs.onLeave = () => { left++; };
    obs.choices.children[1].click();
    check('refusing regret is answered in red', obs.phase === 'late' &&
      obs.finalLast.textContent === PR.i18n.t('regret.late') &&
      obs.finalLast.className.indexOf('mild') < 0, obs.finalLast.textContent);
    check('with the flash and the sting under it',
      obs.pulse.className.indexOf('harsh') >= 0 && obs._fired.indexOf('sting') >= 0);
    check('and the only thing left is the way out',
      obs.choices.children.length === 1 &&
      obs.choices.children[0].textContent === PR.i18n.t('regret.leave'),
      obs.choices.children[0] && obs.choices.children[0].textContent);
    obs.choices.children[0].click();
    check('taking it ends the session rather than the interlude', left === 1 && obs.phase === 'late');
    step(obs, 30);
    check('there is no report on that path, ever', obs.phase !== 'final' && obs.finalGroup.textContent === '');
  }

  {
    const missing = [];
    for (const lang of ['tr', 'en']) {
      PR.i18n.lang = lang;
      for (const k of ['regret.ask', 'regret.yes', 'regret.no', 'regret.earn', 'regret.late', 'regret.leave']) {
        if (PR.i18n.t(k) === k) missing.push(lang + ':' + k);
      }
    }
    PR.i18n.lang = 'tr';
    check('the last question is written in both languages', missing.length === 0, missing.join(' ') || '12 strings');
  }
}

console.log('\nthe last screen');
{
  const verdict = (total) => PR.Survey.verdictFor(total);
  check('three answered mildly is the only way to be worth saving',
    verdict(3) === 'final.saved' && verdict(4) !== 'final.saved');
  check('and three answered worst is the only way to be told off',
    verdict(9) === 'final.pathetic' && verdict(8) !== 'final.pathetic');
  check('everything between is the one with no spine',
    [4, 5, 6, 7, 8].every(n => verdict(n) === 'final.spineless'));

  // 25 of the 27 possible runs land in the middle. That is the joke, and it
  // is worth knowing it is still true if the questions ever change.
  {
    const tally = {};
    for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) for (let c = 1; c <= 3; c++) {
      const key = verdict(a + b + c);
      tally[key] = (tally[key] || 0) + 1;
    }
    check('almost everyone lands in the middle',
      tally['final.saved'] === 1 && tally['final.pathetic'] === 1 && tally['final.spineless'] === 25,
      '1 / 25 / 1 of 27');
  }

  {
    const missing = [];
    for (const lang of ['tr', 'en']) {
      PR.i18n.lang = lang;
      for (const v of PR.Survey.VERDICTS) {
        for (const part of ['name', 'text', 'back']) {
          const key = v.key + '.' + part;
          if (PR.i18n.t(key) === key) missing.push(lang + ':' + key);
        }
      }
      if (PR.i18n.t('final.pathetic.last') === 'final.pathetic.last') missing.push(lang + ':last');
    }
    PR.i18n.lang = 'tr';
    check('every verdict is written in both languages', missing.length === 0, missing.join(' ') || '20 strings');
  }

  // Driven the way the frame loop drives it, so the whole sequence is checked
  // rather than the fact that the methods exist.
  const drive = (weights) => {
    const nodes = {};
    const grab = () => { const n = node(); nodes[Object.keys(nodes).length] = n; return n; };
    const obs = new PR.Observer(node(), node(), node(), node(), node());
    obs.audio = { fire: (n) => (obs._fired = obs._fired || []).push(n), duck: () => {}, sustain: (n) => { obs._bed = n; return { stop: () => {} }; } };
    obs.pulse = node();
    Object.defineProperty(obs.pulse, 'offsetWidth', { get: () => 0 });
    obs.finalStage = grab(); obs.finalGroup = grab(); obs.finalAnalysis = grab();
    obs.finalRecordTitle = grab(); obs.finalRecordLines = grab(); obs.finalLast = grab();
    const ledger = new PR.Ledger();
    ledger.robotAppeared(0); ledger.struckRobot(1, 'ok'); ledger.killed();
    obs.pending = { kills: 20, ledger };
    obs.startSurvey();
    for (const w of weights) {
      const slot = obs.survey.current().order.indexOf(w);
      obs.choices.children[slot].click();
      obs.answering = false;          // the gap is a timer; skip it
      if (!obs.survey.done()) obs.askQuestion(); else obs.endSurvey();
    }
    return obs;
  };
  const step = (obs, seconds) => { for (let i = 0; i < seconds * 60; i++) obs.update(1 / 60, { shake: () => {} }); };

  {
    const obs = drive([1, 1, 1]);
    check('the verdict names itself before anything else',
      obs.phase === 'final' && obs.finalGroup.textContent === PR.i18n.t('final.saved.name'),
      obs.finalGroup.textContent);
    check('and the analysis has not started', obs.finalAnalysis.textContent === '');
    check('with the last screen on its own bed', obs._bed === 'reckoning', obs._bed);

    step(obs, 3);
    const partway = obs.finalAnalysis.textContent.length;
    check('then it types, a character at a time',
      partway > 0 && partway < PR.i18n.t('final.saved.text').length, partway + ' characters in');
    check('the record is still to one side', !obs.finalStage.classList.has('split'));

    step(obs, 12);
    check('it finishes typing the whole analysis',
      obs.finalAnalysis.textContent === PR.i18n.t('final.saved.text'));
    check('then slides over and the record comes in beside it',
      obs.finalStage.classList.has('split') && obs.finalRecordLines.children.length > 0,
      obs.finalRecordLines.children.length + ' lines of record');
    check('and the way out is worded for this group',
      obs.choices.children.length === 1 &&
      obs.choices.children[0].textContent === PR.i18n.t('final.saved.back'),
      obs.choices.children[0] && obs.choices.children[0].textContent);
  }

  // Only one group is told anything after choosing to leave.
  {
    const obs = drive([3, 3, 3]);
    check('three worst answers is told what it is', obs.finalGroup.textContent === PR.i18n.t('final.pathetic.name'));
    step(obs, 20);
    check('and offered no comfort on the way out',
      obs.choices.children[0].textContent === PR.i18n.t('final.pathetic.back'));
    obs.choices.children[0].click();
    check('leaving gets a last word, in red, with a sting under it',
      obs.phase === 'last' && obs.finalLast.textContent === PR.i18n.t('final.pathetic.last') &&
      obs.pulse.className.indexOf('harsh') >= 0 && obs._fired.indexOf('sting') >= 0);
    check('the two columns are gone for it', obs.finalStage.hidden === true);
    step(obs, 4);
    check('and then it goes back to the game', obs.phase === 'fade');
  }

  {
    const obs = drive([1, 3, 2]);
    step(obs, 20);
    check('a middling run gets the middle verdict and is told to earn it',
      obs.finalGroup.textContent === PR.i18n.t('final.spineless.name') &&
      obs.choices.children[0].textContent === PR.i18n.t('final.spineless.back'));
    obs.choices.children[0].click();
    check('and leaves without a last word', obs.phase === 'fade' && obs.finalLast.hidden !== false);
  }
}

console.log('\nthe notice');
{
  const make = () => {
    const root = node(); root.hidden = true;
    const close = node('button');
    return { n: new PR.Notice(root, close), root, close };
  };

  {
    const { n, root } = make();
    check('it is not there until the way in is done', root.hidden === true && !n.visible());
    n.show();
    check('and arrives with the first robot', root.hidden === false && n.visible());
  }

  // The cross is the only way out of it, so it has to work and it has to be
  // the last word on the subject.
  {
    const { n, close } = make();
    n.show();
    close.click();
    check('the cross closes it', n.gone && !n.visible());
    n.show();
    check('and it does not come back', !n.visible());
  }

  // It is a notice, not a gate. Nothing here may stop the scene the way the
  // way in and the interlude do.
  {
    const { n } = make();
    n.show();
    check('it never blocks anything', typeof n.blocking !== 'function');
  }
}

console.log('\ntext');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'i18n.js'), 'utf8');
  const keys = [...src.matchAll(/'([a-z]+\.[a-zA-Z0-9.]+)':/g)].map(m => m[1]);
  const half = keys.length / 2;
  check('both languages define the same keys',
    keys.slice(0, half).sort().join() === keys.slice(half).sort().join(), half + ' each');
  check('an unknown key falls back to itself', PR.i18n.t('nope.nope') === 'nope.nope');
}

console.log('\n' + (failures ? failures + ' FAILED' : 'all good') + '\n');
process.exit(failures ? 1 : 0);
