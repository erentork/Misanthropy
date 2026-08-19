/*
  Entry point: fixed-step loop, scene wiring, integer-scaled presentation.

  The fixed dt is not optional. Verlet derives velocity from the position
  delta, so a variable dt corrupts it and the ragdoll explodes the moment
  the frame rate dips. Leftover time is capped at MAX_SUBSTEPS, so a slow
  machine runs slow instead of blowing up.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const WIDTH = 480, HEIGHT = 270;
  const DT = 1 / 120, MAX_SUBSTEPS = 6;

  const viewport = PR.viewport = { scale: 1, ox: 0, oy: 0 };
  const state = { debug: false, held: null, hover: null, paused: false, style: 'normal' };

  const canvas = document.getElementById('view');
  const ctx = canvas.getContext('2d');
  const raster = new PR.Raster(WIDTH, HEIGHT);

  let world, scene, input = null, ui = null, observer = null, ledger = null, clock = 0;
  let welcome = null;
  const audio = PR.audio = new PR.Audio();
  let kills = 0;   // survives a new robot: the tally is the players, not the scene

  function build(durability) {
    world = new PR.World(WIDTH, HEIGHT);
    const fx = new PR.Fx(WIDTH, HEIGHT);
    fx.audio = audio;
    // Centred, and alone. It used to stand off to one side with a shotgun
    // already lying on the floor, which answered the question of what to do
    // before the player had asked it. Now the room is empty and reaching for
    // a weapon is a decision with a moment in front of it -- which is the
    // thing the record is measuring.
    const robot = PR.buildRobot(world, WIDTH * 0.5, world.floor, { durability: durability });
    robot.counted = false;
    // The record watches through these two hooks and nothing else, so the
    // robot has no idea it is being counted.
    robot.onDamage = (amount, stateBefore) => ledger.struckRobot(clock, stateBefore);
    robot.onBreak = () => ledger.limbLost();
    ledger.robotAppeared(clock);
    scene = { fx, robot, items: [], behaviour: new PR.Behaviour(robot, world) };
    // Which robot this is, counting from one. The fifth always speaks; a
    // few of the ones after it do, and the rest never say anything.
    scene.plea = PR.Plea.for(kills + 1, PR.candidate.name);
    if (input) { input.detach(); input.world = world; }
    if (ui) ui.close();
    state.hover = null;
    updateHud();
  }

  function spawn(kind, x, y) {
    if (x === undefined) {
      // Drop it where the cursor is, which is where the eye already is.
      const t = input && input.target;
      const inside = t && t.x > 8 && t.x < WIDTH - 8 && t.y > 8 && t.y < world.floor;
      x = inside ? t.x : WIDTH * 0.2;
      y = inside ? t.y : world.floor - 40;
    }
    const item = PR.spawnItem(world, kind, x, y);
    if (item) scene.items.push(item);
    return item;
  }

  function remove(item) {
    const i = scene.items.indexOf(item);
    if (i < 0) return;
    scene.items.splice(i, 1);
    if (item.points.indexOf(state.held) >= 0) input.detach();
    if (item.points.indexOf(state.hover) >= 0) state.hover = null;
    PR.removeItem(world, scene.robot, item);
  }

  // The item the mouse is holding, if any; otherwise the newest one that can
  // do the job, so the keyboard still works with nothing in hand.
  function activeItem(ability) {
    for (const item of scene.items) if (item.held() && item[ability]) return item;
    for (let i = scene.items.length - 1; i >= 0; i--) if (scene.items[i][ability]) return scene.items[i];
    return null;
  }

  function updateHud() {
    document.getElementById('style-name').textContent = state.style;
    document.getElementById('armour').textContent = scene.robot.durability;
    document.getElementById('kills').textContent = kills;
    document.getElementById('sound-state').textContent = PR.i18n.t(audio.muted ? 'sound.off' : 'sound.on');
  }

  // A robot counts as killed the first time it loses a joint, which is the
  // same moment its servos cut out for good.
  function countKill() {
    if (scene.robot.state !== 'dead' || scene.robot.counted) return;
    scene.robot.counted = true;
    kills++;
    ledger.killed();
    updateHud();
    if (kills % observer.every === 0) observer.trigger(kills, ledger);
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const s = Math.max(1, Math.floor(Math.min(canvas.width / WIDTH, canvas.height / HEIGHT)));
    viewport.scale = s;
    viewport.ox = Math.floor((canvas.width - WIDTH * s) / 2);
    viewport.oy = Math.floor((canvas.height - HEIGHT * s) / 2);
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);

  PR.i18n.start();
  ledger = new PR.Ledger();
  observer = new PR.Observer(document.getElementById('observer'),
    document.getElementById('observer-line'),
    document.getElementById('observer-choices'),
    document.getElementById('observer-report'),
    document.getElementById('observer-logo'));
  observer.audio = audio;
  observer.pulse = document.getElementById('pulse');
  observer.finalStage = document.getElementById('observer-final');
  observer.finalGroup = document.getElementById('final-group');
  observer.finalAnalysis = document.getElementById('final-analysis');
  observer.finalRecordTitle = document.getElementById('final-record-title');
  observer.finalRecordLines = document.getElementById('final-record-lines');
  observer.finalLast = document.getElementById('final-last');
  // Refusing to be judged is granted exactly, and it costs the rest of the
  // session. A tab cannot close itself unless a script opened it, so the
  // observer asks and this is the fallback: everything on the page goes, the
  // sound goes, and there is nothing left to click. A reload starts over,
  // which is the only door back and is not advertised.
  observer.onLeave = () => {
    audio.setMuted(true);
    document.body.textContent = '';
    document.body.style.background = '#000';
    document.documentElement.style.background = '#000';
  };
  // Refusing the record is a promise that the game stops putting words on
  // screen, so the hint bar goes with it.
  observer.onSilence = () => { document.getElementById('hints').hidden = true; };
  observer.onWake = () => { document.getElementById('hints').hidden = false; };
  if (observer.silenced) {
    observer.onSilence();
    console.info('[misanthropy] Interludes are silenced: the record was refused, ' +
      'and that is remembered across reloads. Press 0, or right click > start the ' +
      'experiment over, to bring them back.');
  }
  PR.i18n.onChange(() => updateHud());

  welcome = new PR.Welcome(document.getElementById('welcome'),
    document.getElementById('welcome-name'),
    document.getElementById('welcome-begin'));
  welcome.audio = audio;
  // The way in is what has been covering the scene, so the moment it goes is
  // the moment the first robot is on screen. That is when the notice about
  // them belongs, and it does not block: the robot stands there being looked
  // at while it is read.
  const notice = new PR.Notice(document.getElementById('notice'),
    document.getElementById('notice-close'));
  welcome.onBegin = () => notice.show();

  build(3);
  resize();

  input = new PR.Input(canvas, world, state, {
    aim: (d) => { const item = activeItem('turnAim'); if (item) item.turnAim(d); },
    menu: (wx, wy, cx, cy) => ui.open(cx, cy, PR.itemAt(scene.items, wx, wy, 16)),
    closeMenu: () => ui.close(),
    blocked: () => observer.blocking() || welcome.blocking()
  });

  ui = PR.setupUi({
    spawn: (kind) => spawn(kind),
    remove: (item) => remove(item),
    clearItems: () => { while (scene.items.length) remove(scene.items[0]); },
    reset: () => build(scene.robot.durability),
    restart: restartExperiment
  });

  // Starts the whole thing over: the tally, the record, and the silence a
  // refusal leaves behind. A refusal is meant to be permanent for a player,
  // but with no way back it looks exactly like the game having broken -- the
  // interludes stop, the hint bar goes, and nothing a reload does brings
  // either back. Hence a key as well as a menu entry.
  function restartExperiment() {
    kills = 0;
    ledger = new PR.Ledger();
    observer.unsilence();
    build(scene.robot.durability);
  }

  function fire() {
    const item = activeItem('fire');
    if (item && item.fire({ world, robot: scene.robot, fx: scene.fx })) ledger.shot();
  }

  // Clicking through the black skips the wait; the shake is never skippable.
  // The gesture is also what the audio context has been waiting for: a
  // browser will not let one start before the page has been touched.
  document.addEventListener('pointerdown', () => {
    audio.start();
    if (!observer.asking()) observer.skip();
  });

  window.addEventListener('keydown', (e) => {
    audio.start();
    // Every shortcut is a bare letter, so while a name is being typed none of
    // them may fire.
    if (welcome.blocking()) return;
    if (observer.blocking()) { if (!observer.asking()) observer.skip(); return; }
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') { scene.robot.setDurability(parseInt(k, 10)); updateHud(); return; }
    if (k === '0') restartExperiment();
    else if (k === 'r') build(scene.robot.durability);
    else if (k === 'f') fire();
    else if (k === 'm') { audio.toggleMute(); updateHud(); }
    else if (k === 'g') world.gravityOn = !world.gravityOn;
    else if (k === 'd') state.debug = !state.debug;
    else if (k === 's') {
      const names = PR.styleNames, i = names.indexOf(state.style);
      state.style = names[(i + 1) % names.length];
      updateHud();
    } else if (k === ' ') { state.paused = !state.paused; e.preventDefault(); }
  });

  let accumulator = 0, last = performance.now();
  function frame(now) {
    let elapsed = (now - last) / 1000; last = now;
    if (elapsed > 0.25) elapsed = 0.25;     // swallow tab-switch time jumps
    observer.update(elapsed, scene.fx);
    if (!state.paused && !observer.blocking() && !welcome.blocking()) {
      clock += elapsed;
      accumulator += elapsed;
      const steps = Math.min(MAX_SUBSTEPS, Math.floor(accumulator / DT));
      const itemCtx = { world, robot: scene.robot, fx: scene.fx };
      for (let i = 0; i < steps; i++) {
        input.applySubstep((i + 1) / steps);
        world.step(DT);
        scene.robot.handleContacts(world, scene.fx, clock);
        scene.fx.debrisContacts(world, clock);
        // Stabs are checked per substep: a swung blade covers several pixels
        // in one, and a per-frame check would sweep straight past a limb.
        for (const item of scene.items) if (item.sweeps) item.update(DT, itemCtx);
        accumulator -= DT;
      }
      if (steps > 0) input.endFrame(steps);
      if (accumulator > 0.25) accumulator = 0;
      for (const item of scene.items) if (!item.sweeps) item.update(elapsed, itemCtx);
      scene.behaviour.update(elapsed, scene.items);
      if (scene.plea) scene.plea.update(elapsed, scene.robot.alive);
      scene.robot.update(elapsed, scene.fx);
      scene.fx.update(elapsed, world);
      countKill();
    }

    PR.draw(raster, world, scene, state);
    const shake = scene.fx.shakeOffset();
    ctx.fillStyle = '#e9e9e9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    raster.present(ctx, viewport.scale,
      viewport.ox + shake.x * viewport.scale,
      viewport.oy + shake.y * viewport.scale);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(window);
