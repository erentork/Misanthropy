/*
  Mouse grabbing, wheel aiming, firing.

  The detail that matters for grabbing: the target position is interpolated
  across the physics substeps (applySubstep). Without it the grabbed point
  snaps to the mouse on the first substep and sits still for the rest, so
  its velocity at release is zero and nothing can ever be thrown.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const AIM_STEP = 0.055;   // radians per wheel notch
  const MAX_THROW = 14;     // px per substep, so a flick cannot launch into orbit

  PR.Input = class {
    constructor(canvas, world, state, hooks) {
      this.canvas = canvas;
      this.world = world;
      this.state = state;
      this.hooks = hooks || {};
      this.radius = 14;       // grab radius, world pixels
      // Pull per constraint pass. At 0.35 the point converges 99% of the way
      // to the cursor every substep, which is a weld -- the body then reads
      // as rigid however soft its joints are. 0.14 leaves the grab springy
      // and still throws cleanly.
      this.strength = 0.14;
      this.target = { x: 0, y: 0 };
      this.prevTarget = { x: 0, y: 0 };
      this.point = null;
      this.throwVel = { x: 0, y: 0 };
      this.steps = 2;

      const at = (e) => {
        const v = PR.viewport;
        return { x: (e.clientX - v.ox) / v.scale, y: (e.clientY - v.oy) / v.scale };
      };

      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      canvas.addEventListener('pointerdown', (e) => {
        if (this.hooks.blocked && this.hooks.blocked()) return;
        const t = at(e);
        this.target = t; this.prevTarget = { x: t.x, y: t.y };
        // Right click belongs to the context menu now; firing is on F.
        if (e.button === 2) {
          if (this.hooks.menu) this.hooks.menu(t.x, t.y, e.clientX, e.clientY);
          return;
        }
        if (this.hooks.closeMenu) this.hooks.closeMenu();
        const p = this.world.nearest(t.x, t.y, this.radius);
        if (p) {
          this.point = p;
          p.grab = { x: t.x, y: t.y, k: this.strength };
          state.held = p;
          canvas.setPointerCapture(e.pointerId);
        }
      });

      canvas.addEventListener('pointermove', (e) => {
        this.target = at(e);
        if (!this.point) state.hover = this.world.nearest(this.target.x, this.target.y, this.radius);
      });

      // Release throw. With a springy grab the held point always lags the
      // cursor, so whatever velocity it happens to have at release is far
      // short of the throw that was aimed -- hand it the cursor's own speed
      // instead. Verlet velocity is displacement per substep, hence the
      // divide by the substep count the last frame actually ran.
      const release = () => {
        if (this.point) {
          const v = this.throwVel;
          const speed = Math.hypot(v.x, v.y);
          const cap = speed > MAX_THROW ? MAX_THROW / speed : 1;
          this.point.setVelocity(v.x * cap, v.y * cap);
          this.point.grab = null;
          this.point = null;
        }
        state.held = null;
      };
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      canvas.addEventListener('pointerleave', () => { state.hover = null; });

      // Wheel up raises the barrel: screen y grows downwards, so a negative
      // deltaY has to decrease the aim angle.
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (this.hooks.blocked && this.hooks.blocked()) return;
        if (this.hooks.aim) this.hooks.aim(Math.sign(e.deltaY) * AIM_STEP);
      }, { passive: false });
    }

    applySubstep(alpha) {
      if (!this.point || !this.point.grab) return;
      const g = this.point.grab;
      g.x = this.prevTarget.x + (this.target.x - this.prevTarget.x) * alpha;
      g.y = this.prevTarget.y + (this.target.y - this.prevTarget.y) * alpha;
    }

    endFrame(steps) {
      this.steps = Math.max(1, steps || this.steps);
      const vx = (this.target.x - this.prevTarget.x) / this.steps;
      const vy = (this.target.y - this.prevTarget.y) / this.steps;
      // Light smoothing, so one stuttering frame cannot ruin a throw.
      this.throwVel.x = this.throwVel.x * 0.35 + vx * 0.65;
      this.throwVel.y = this.throwVel.y * 0.35 + vy * 0.65;
      this.prevTarget.x = this.target.x; this.prevTarget.y = this.target.y;
    }

    detach() { if (this.point) { this.point.grab = null; this.point = null; } this.state.held = null; }
  };
})(window);
