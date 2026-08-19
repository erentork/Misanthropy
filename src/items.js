/*
  Spawnable items: the shotgun, the knife and the axe.

  Every item is two physics points joined by a bone -- a grip and a tip --
  so it can be grabbed, thrown, dropped and left lying around like anything
  else, and its orientation comes for free from the two points.

  Items are spawned and deleted from the menus, so nothing here may assume
  it is the only one, or that it lives for the whole session.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const PULL_OUT = 13;        // how far the cursor must lead a buried blade to free it
  const RESTAB_DELAY = 0.3;   // seconds after pulling out before it can bite again

  const SPEED_CAP = 12;       // impact speed the maths is allowed to see
  const BOND_MIN = 2;         // shortest bond length, so a buried blade cannot go degenerate

  function pair(world, x, y, length, gripMass, tipMass, gripR, tipR) {
    const grip = world.add(new PR.Point(x, y, { r: gripR, invMass: 1 / gripMass, friction: 0.5, bounce: 0.15 }));
    const tip = world.add(new PR.Point(x + length, y, { r: tipR, invMass: 1 / tipMass, friction: 0.5, bounce: 0.15 }));
    grip.tag = 'item'; tip.tag = 'item';
    world.stick(grip, tip);
    return { grip, tip };
  }

  // Wheel aiming, shared by everything you can point.
  //
  // 'hold' keeps the angle from inside the constraint loop the whole time it
  // is held, which is what a gun wants. 'nudge' starts loose -- the blade
  // hangs and swings from the hand like a ragdoll -- and the first turn of
  // the wheel latches it into the angle you chose. The latch lasts until the
  // grab is let go, so a blade can be lined up, carried at that angle and
  // swung, and only becomes loose again when you next pick it up.
  function aimable(item, world, mode) {
    const grip = item.grip, tip = item.tip;

    item.aim = Math.atan2(tip.y - grip.y, tip.x - grip.x);
    item.aimMode = mode;
    item.aimLatched = false;

    item.direction = function () {
      const dx = tip.x - grip.x, dy = tip.y - grip.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    };

    item.turnAim = function (delta) {
      if (this.aimMode === 'nudge' && !this.aimLatched) {
        // Pick up from wherever the blade actually is, or the first notch
        // snaps it back to a stale angle.
        this.aim = Math.atan2(tip.y - grip.y, tip.x - grip.x);
      }
      this.aim += delta;
      if (this.aim > Math.PI) this.aim -= Math.PI * 2;
      if (this.aim < -Math.PI) this.aim += Math.PI * 2;
      this.aimLatched = true;
    };

    item.aiming = function () {
      return this.aimMode === 'hold' ? this.held() : (this.held() && this.aimLatched);
    };

    item.applyAim = function () {
      if (this.stuck || !this.aiming()) return;
      const c = Math.cos(this.aim) * this.length, s = Math.sin(this.aim) * this.length;
      if (tip.grab) {
        grip.x += (tip.x - c - grip.x) * 0.5;
        grip.y += (tip.y - s - grip.y) * 0.5;
      } else {
        tip.x += (grip.x + c - tip.x) * 0.5;
        tip.y += (grip.y + s - tip.y) * 0.5;
      }
    };

    // Letting go drops the latch, and whenever it is not being aimed it
    // follows its own body, so the next wheel notch starts from the angle it
    // is really at.
    item.followBody = function () {
      if (!this.held()) this.aimLatched = false;
      if (!this.aiming()) this.aim = Math.atan2(tip.y - grip.y, tip.x - grip.x);
    };

    item.extra = () => item.applyAim();
    world.extras.push(item.extra);
    return item;
  }

  function buildShotgun(world, x, y, opts) {
    const s = (opts && opts.scale) || 1;
    const { grip, tip } = pair(world, x, y, 26 * s, 2.4, 1.6, 4 * s, 3 * s);

    const gun = {
      kind: 'shotgun', scale: s, grip, tip, muzzle: tip, points: [grip, tip],
      length: 26 * s, stuck: null,
      pellets: 9, spread: 0.115, range: 430 * s, hitDamage: 6, impulse: 0.55,
      cooldownTime: 0.6, cooldown: 0, flash: 0,

      held() { return !!(grip.grab || tip.grab); },

      update(dt) {
        if (this.cooldown > 0) this.cooldown -= dt;
        if (this.flash > 0) this.flash -= dt;
        this.followBody();
      },

      // Pellets are hitscan. Buckshot moves further per step than a limb is
      // wide, so a real projectile would tunnel straight through.
      fire(ctx) {
        if (this.cooldown > 0) return false;
        this.cooldown = this.cooldownTime;
        this.flash = 0.07;
        const { world, robot, fx } = ctx;
        const d = this.direction();
        const ox = tip.x + d.x * 4 * s, oy = tip.y + d.y * 4 * s;
        const base = Math.atan2(d.y, d.x);
        const isRobot = (p) => p.tag === 'robot';

        for (let i = 0; i < this.pellets; i++) {
          const a = base + (Math.random() - 0.5) * this.spread;
          const dx = Math.cos(a), dy = Math.sin(a);
          const hit = world.raycast(ox, oy, dx, dy, this.range, isRobot);
          if (hit) {
            fx.tracer(ox, oy, hit.x, hit.y);
            const p = hit.point;
            p.setVelocity(p.vx + dx * this.impulse, p.vy + dy * this.impulse);
            robot.hit(world, fx, p, hit.x, hit.y, dx, dy, this.hitDamage);
          } else {
            fx.tracer(ox, oy, ox + dx * this.range, oy + dy * this.range);
          }
        }

        grip.setVelocity(grip.vx - d.x * 1.9, grip.vy - d.y * 1.9 - 0.5);
        tip.setVelocity(tip.vx - d.x * 1.2, tip.vy - d.y * 1.2 - 1.1);
        fx.shake(7.5);
        fx.sound('shot');
        return true;
      }
    };

    return aimable(gun, world, 'hold');
  }

  // Knife and axe are the same weapon with different numbers: how fast it
  // has to be moving to bite, how deep it sinks, and how much it takes off.
  const BLADES = {
    knife: {
      length: 30, gripMass: 1.5, tipMass: 0.7, gripR: 3.2, tipR: 1.7,
      biteSpeed: 1.1, depthPerSpeed: 3.2, depthMin: 2, depthMax: 14,
      damageBase: 9, damagePerSpeed: 5, damageCap: 34, shake: 2.5, oil: 14
    },
    axe: {
      // Head-heavy, so it swings like an axe rather than a stick, and buries
      // itself far deeper for the weight it carries.
      length: 34, gripMass: 1.2, tipMass: 3.4, gripR: 3.0, tipR: 3.4,
      biteSpeed: 1.0, depthPerSpeed: 3.6, depthMin: 3, depthMax: 18,
      damageBase: 14, damagePerSpeed: 7, damageCap: 48, shake: 4.5, oil: 20
    }
  };

  function buildBlade(kind, world, x, y, opts) {
    const s = (opts && opts.scale) || 1;
    const cfg = BLADES[kind];
    const { grip, tip } = pair(world, x, y, cfg.length * s,
      cfg.gripMass, cfg.tipMass, cfg.gripR * s, cfg.tipR * s);

    const blade = {
      kind, scale: s, cfg, grip, tip, points: [grip, tip],
      length: cfg.length * s,
      sweeps: true,                 // needs a per-substep update, see main.js
      stuck: null, bonds: null, bound: null, delay: 0,

      held() { return !!(grip.grab || tip.grab); },

      update(dt, ctx) {
        if (this.delay > 0) this.delay -= dt;
        const { world, robot, fx } = ctx;

        if (this.stuck) {
          // Pulling it back out: the cursor has to lead the buried blade by
          // a clear margin, so nudging it while it is in does not free it.
          if (!this.held()) return;
          const p = grip.grab ? grip : tip;
          if (Math.hypot(p.grab.x - p.x, p.grab.y - p.y) > PULL_OUT) this.pullOut(world, robot, fx);
          return;
        }

        this.followBody();
        if (this.delay > 0) return;

        const vx = tip.x - tip.px, vy = tip.y - tip.py;
        const speed = Math.hypot(vx, vy);
        if (speed < cfg.biteSpeed) return;
        // Sweep from where the tip was to where it is. Testing its current
        // position alone misses: a swung blade covers several pixels a
        // substep and would pass clean through a thin limb.
        const inv = 1 / speed;
        const hit = world.raycast(tip.px, tip.py, vx * inv, vy * inv, speed + tip.r * 1.5,
          (p) => p.tag === 'robot');
        if (hit) this.bite(world, robot, fx, hit, speed);
      },

      bite(world, robot, fx, hit, rawSpeed) {
        const part = robot.partOf.get(hit.point);
        if (!part) return;
        // Bind to the bone that was struck, not just to the point, or the
        // blade is free to spin around a single pivot.
        let seg = null, bestD = Infinity;
        for (const candidate of robot.segments) {
          if (candidate.a !== hit.point && candidate.b !== hit.point) continue;
          const d = Math.hypot((candidate.a.x + candidate.b.x) / 2 - hit.x,
                               (candidate.a.y + candidate.b.y) / 2 - hit.y);
          if (d < bestD) { bestD = d; seg = candidate; }
        }
        if (!seg) return;

        // Everything downstream reads a clamped speed. A blade flicked at
        // the cap would otherwise ask to be buried further than the limb is
        // thick and hand the solver a degenerate bond.
        const speed = Math.min(rawSpeed, SPEED_CAP);
        const d = this.direction();
        const want = (speed - cfg.biteSpeed) * cfg.depthPerSpeed * s;
        // How much of the bone the blade is allowed to occupy. Too tight and
        // every swing above walking pace bottoms out at the same depth, so
        // the speed stops reading; this leaves enough range to see it.
        const room = Math.max(seg.r0, seg.r1) * 2.2;
        const depth = Math.max(cfg.depthMin * s, Math.min(want, cfg.depthMax * s, room));

        // Sink it in, then stop it dead: it is in the limb now, not still
        // travelling through it.
        for (const p of this.points) {
          p.moveTo(p.x + d.x * depth, p.y + d.y * depth);
          p.setVelocity(0, 0);
        }

        const bond = (a, b) => world.stick(a, b,
          { length: Math.max(BOND_MIN * s, Math.hypot(b.x - a.x, b.y - a.y)) });
        this.bonds = [bond(tip, seg.a), bond(tip, seg.b), bond(grip, seg.a)];
        world.link(grip, seg.b);
        this.bound = [seg.a, seg.b];
        // The blade joins the limb's part set, so if that limb is later shot
        // off it rides away still buried in it: detach() only drops
        // constraints crossing a part boundary, and by now it is inside.
        robot.embed(part, this.points);
        this.stuck = { part, seg, depth };

        fx.spray(hit.x, hit.y, d.x * 1.2, d.y * 1.2 - 0.4, cfg.oil, 1.8);
        fx.shake(cfg.shake);
        fx.sound('bite', { heavy: kind === 'axe' });
        robot.damage(world, fx, hit.point,
          Math.min(cfg.damageCap, cfg.damageBase + speed * cfg.damagePerSpeed));
      },

      pullOut(world, robot, fx) {
        world.removeConstraints(this.bonds);
        for (const anchor of this.bound)
          for (const own of this.points) world.unlink(anchor, own);
        robot.release(this.points);
        fx.spray(tip.x, tip.y, 0, -0.35, 10, 1.3);
        fx.sound('pull');
        this.stuck = null; this.bonds = null; this.bound = null;
        this.delay = RESTAB_DELAY;
      }
    };

    return aimable(blade, world, 'nudge');
  }

  // Labels are i18n keys, not text: the palette and the right-click menu are
  // rebuilt on every language change.
  PR.ITEMS = {
    shotgun: { labelKey: 'item.shotgun', build: buildShotgun },
    knife: { labelKey: 'item.knife', build: (w, x, y, o) => buildBlade('knife', w, x, y, o) },
    axe: { labelKey: 'item.axe', build: (w, x, y, o) => buildBlade('axe', w, x, y, o) }
  };

  PR.spawnItem = function (world, kind, x, y, opts) {
    const def = PR.ITEMS[kind];
    return def ? def.build(world, x, y, opts) : null;
  };

  PR.removeItem = function (world, robot, item) {
    for (const p of item.points) p.grab = null;
    if (item.bonds) world.removeConstraints(item.bonds);
    world.removePoints(new Set(item.points));
    if (item.extra) world.extras = world.extras.filter(fn => fn !== item.extra);
    if (robot) robot.release(item.points);
  };

  // Nearest item to a world position, for the right-click menu.
  PR.itemAt = function (items, x, y, radius) {
    let best = null, bestD = radius * radius;
    for (const item of items) {
      for (const p of item.points) {
        const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (d < bestD) { bestD = d; best = item; }
      }
    }
    return best;
  };
})(window);
