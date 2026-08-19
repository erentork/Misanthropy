/*
  Oil, stains, tracers, screen shake and sound.

  Droplets are a separate lightweight system rather than world points: a
  burst is dozens of particles, and the world solver is O(n^2) across every
  point it owns. Oil does not need to collide with anything except the
  ground, and once it lands it stops being a particle at all -- it is baked
  into a stain buffer that is never cleared, so spills stay for good.

  This is the feedback layer: everything the player is told about an event
  that is not the simulation itself. Sound arrives through here for that
  reason and no other -- every site that would ask for a sound already holds
  an fx and already asks it for spray and shake, so routing audio the same
  way costs no new plumbing in the robot or the items. The synthesiser lives
  in audio.js and is attached from main.js; with nothing attached, sound()
  is a no-op, which is how the headless tests stay silent.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const OIL_DROP  = PR.rgb(38, 30, 16);
  const OIL_STAIN = [PR.rgb(46, 37, 20), PR.rgb(64, 53, 32)];
  const TRACER    = PR.rgb(120, 112, 96);

  PR.Fx = class {
    constructor(width, height) {
      this.width = width; this.height = height;
      this.mask = new Uint8Array(width * height);   // 0 empty, else shade+1
      this.stains = [];                             // indices into mask, for drawing
      this.drops = [];
      this.tracers = [];
      this.shakeAmount = 0;
      this.gravity = 460;
      this.audio = null;                            // set by main.js, absent in tests
    }

    shake(amount) { if (amount > this.shakeAmount) this.shakeAmount = amount; }

    sound(name, opts) { if (this.audio) this.audio.fire(name, opts); }

    // Loose hardware landing: popped bolts and dropped weapons. The robot
    // does its own contacts because a hit there is also damage; this is the
    // rest of the scene, which only ever makes a noise. Each point carries
    // its own last-clank time, or a bolt settling into a corner rings once a
    // step for as long as it takes to stop rolling.
    debrisContacts(world, clock) {
      if (!this.audio) return;
      for (const c of world.contacts) {
        const tag = c.point.tag;
        if (tag !== 'bolt' && tag !== 'item') continue;
        if (c.speed < 1.6) continue;
        if (clock - (c.point.lastClank || -1) < 0.12) continue;
        c.point.lastClank = clock;
        this.sound(tag === 'bolt' ? 'bolt' : 'clank');
      }
    }

    shakeOffset() {
      const a = this.shakeAmount;
      if (a < 0.2) return { x: 0, y: 0 };
      return { x: Math.round((Math.random() - 0.5) * 2 * a), y: Math.round((Math.random() - 0.5) * 2 * a) };
    }

    // vx/vy are px per second, like the droplets themselves.
    spray(x, y, vx, vy, count, power) {
      power = power === undefined ? 1 : power;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (20 + Math.random() * 90) * power;
        this.drops.push({
          x, y,
          vx: vx * 60 + Math.cos(a) * speed,
          vy: vy * 60 + Math.sin(a) * speed - 20 * power,
          life: 1.5 + Math.random() * 2.5
        });
      }
    }

    tracer(x0, y0, x1, y1) { this.tracers.push({ x0, y0, x1, y1, life: 0.06 }); }

    update(dt, world) {
      this.shakeAmount *= Math.exp(-dt * 11);

      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.vy += this.gravity * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt;
        let landed = false;
        if (d.y >= world.floor) { d.y = world.floor; landed = true; }
        else if (d.x <= 0) { d.x = 0; landed = true; }
        else if (d.x >= this.width - 1) { d.x = this.width - 1; landed = true; }
        else if (d.y <= 0) { d.y = 0; landed = true; }
        if (landed || d.life <= 0) {
          if (landed) this.bake(d.x, d.y, Math.hypot(d.vx, d.vy) > 200 ? 2 : 1);
          this.drops.splice(i, 1);
        }
      }

      for (let i = this.tracers.length - 1; i >= 0; i--) {
        this.tracers[i].life -= dt;
        if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
      }
    }

    bake(x, y, size) {
      x = Math.round(x); y = Math.round(y);
      for (let j = -size; j <= size; j++) {
        for (let i = -size; i <= size; i++) {
          if (i * i + j * j > size * size + 1) continue;
          if (Math.random() < 0.25) continue;             // ragged edge
          const px = x + i, py = y + j;
          if (px < 0 || py < 0 || px >= this.width || py >= this.height) continue;
          const idx = py * this.width + px;
          const shade = (i === 0 && j === 0) || Math.random() < 0.55 ? 1 : 2;
          if (this.mask[idx] === 0) this.stains.push(idx);
          // A fresh dark splat is allowed to darken an old light one.
          if (this.mask[idx] === 0 || shade < this.mask[idx]) this.mask[idx] = shade;
        }
      }
    }

    drawStains(raster) {
      for (const idx of this.stains) raster.data[idx] = OIL_STAIN[this.mask[idx] - 1];
    }

    drawDrops(raster) {
      for (const d of this.drops) raster.plot(d.x, d.y, OIL_DROP);
      for (const t of this.tracers) raster.line(t.x0, t.y0, t.x1, t.y1, TRACER, 1);
    }
  };
})(window);
