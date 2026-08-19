/*
  Verlet-based physics core.

  Why Verlet and not an impulse solver: constraints correct positions
  directly, and velocity is derived from the position delta, so collisions,
  joint limits and the mouse grab all fall out of one mechanism. For a
  15-point ragdoll a Box2D-class engine would be far more machinery than
  the result needs.
*/
(function (global) {
  'use strict';
  const PR = global.PR || (global.PR = {});

  let nextId = 1;

  // Mass point. Velocity is not stored: v = (x - px). Teleporting a point
  // therefore means moving px along with it (see moveTo).
  class Point {
    constructor(x, y, opts) {
      opts = opts || {};
      this.id = nextId++;
      this.x = x; this.y = y;
      this.px = x; this.py = y;      // previous position = the velocity
      this.ax = 0; this.ay = 0;      // extra acceleration for this step
      this.r = opts.r !== undefined ? opts.r : 2;
      this.invMass = opts.invMass !== undefined ? opts.invMass : 1;
      this.friction = opts.friction !== undefined ? opts.friction : 0.35;
      this.bounce = opts.bounce !== undefined ? opts.bounce : 0.06;
      this.noCollide = new Set();    // ids this point never touches
      // Side view fakes depth: near and far limbs sit at different depths
      // and must pass through each other, or the two legs shove constantly.
      this.depth = opts.depth || 'mid';
      this.grab = null;              // {x, y, k} mouse target
    }
    get vx() { return this.x - this.px; }
    get vy() { return this.y - this.py; }
    setVelocity(vx, vy) { this.px = this.x - vx; this.py = this.y - vy; }
    moveTo(x, y) { const dx = x - this.x, dy = y - this.y; this.x = x; this.y = y; this.px += dx; this.py += dy; }
  }

  // Fixed-length bone. stiffness below 1 behaves like a soft spring, which
  // is what muscle tone uses; the skeleton itself runs at 1.
  class Stick {
    constructor(a, b, opts) {
      opts = opts || {};
      this.a = a; this.b = b;
      this.length = opts.length !== undefined ? opts.length : Math.hypot(b.x - a.x, b.y - a.y);
      this.stiffness = opts.stiffness !== undefined ? opts.stiffness : 1;
    }
    solve() {
      const a = this.a, b = this.b;
      const w = a.invMass + b.invMass;
      if (w === 0) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const diff = ((d - this.length) / d) * this.stiffness;
      const ka = a.invMass / w, kb = b.invMass / w;
      a.x += dx * diff * ka; a.y += dy * diff * ka;
      b.x -= dx * diff * kb; b.y -= dy * diff * kb;
    }
  }

  // Joint limit: keeps the distance between two points inside [min, max].
  // Clamping shoulder-to-hand distance is the cheapest way to stop an elbow
  // from folding past its range, with no angle math anywhere.
  class Range {
    constructor(a, b, min, max) { this.a = a; this.b = b; this.min = min; this.max = max; }
    solve() {
      const a = this.a, b = this.b;
      const w = a.invMass + b.invMass;
      if (w === 0) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const target = d < this.min ? this.min : (d > this.max ? this.max : d);
      if (target === d) return;
      const diff = (d - target) / d;
      const ka = a.invMass / w, kb = b.invMass / w;
      a.x += dx * diff * ka; a.y += dy * diff * ka;
      b.x -= dx * diff * kb; b.y -= dy * diff * kb;
    }
  }

  // Hinge direction: in an a-b-c chain, b always stays on the same side of
  // the a-to-c axis. A distance limit cannot express this, because distance
  // has no side, so a knee would happily bend forwards. Signed area does.
  // The sign is read off the rest pose, so building the skeleton with a
  // slight bend at every joint is all the setup this needs.
  class Bend {
    constructor(a, b, c, sign, margin) {
      this.a = a; this.b = b; this.c = c;
      this.sign = sign;
      this.margin = margin || 1.5;   // minimum distance from the axis, px
    }
    solve() {
      const a = this.a, b = this.b, c = this.c;
      const ex = c.x - a.x, ey = c.y - a.y;
      const len = Math.hypot(ex, ey);
      if (len < 1e-6) return;
      const d = ((ex * (b.y - a.y) - ey * (b.x - a.x)) / len) * this.sign;
      if (d >= this.margin) return;
      const push = this.margin - d;
      const nx = (-ey / len) * this.sign, ny = (ex / len) * this.sign;
      const ends = (a.invMass + c.invMass) * 0.25;
      const w = b.invMass + ends;
      if (w === 0) return;
      const kb = b.invMass / w, ke = (ends / w) * 0.5;
      b.x += nx * push * kb; b.y += ny * push * kb;
      a.x -= nx * push * ke; a.y -= ny * push * ke;
      c.x -= nx * push * ke; c.y -= ny * push * ke;
    }
  }

  class World {
    constructor(width, height) {
      this.width = width; this.height = height;
      this.floor = height - 20;
      this.points = [];
      this.sticks = [];
      this.ranges = [];
      this.bends = [];
      this.gravity = 460;        // px/s^2 (a ~110px character reads as ~1.75m)
      this.gravityOn = true;
      this.damping = 0.999;      // air drag
      this.iterations = 10;      // constraint passes; stiffness comes from here
      this.selfCollide = true;
      // Solvers that are not plain constraints (weapon aiming). They run
      // inside the iteration loop so they can hold against gravity.
      this.extras = [];
      this.contacts = [];        // {point, speed} filled per step, for impact fx
    }

    add(p) { this.points.push(p); return p; }
    stick(a, b, opts) { const s = new Stick(a, b, opts); this.sticks.push(s); this.link(a, b); return s; }
    range(a, b, min, max) { const r = new Range(a, b, min, max); this.ranges.push(r); this.link(a, b); return r; }
    bend(a, b, c, sign, margin) { const k = new Bend(a, b, c, sign, margin); this.bends.push(k); return k; }
    // Connected points must not push each other apart, or joints jitter.
    link(a, b) { a.noCollide.add(b.id); b.noCollide.add(a.id); }

    // Everything that connects the given point set to the rest of the body
    // is dropped. Dismemberment then needs no bookkeeping per joint: name
    // the limb, and whatever held it on stops existing.
    detach(pointSet) {
      const inside = (p) => pointSet.has(p);
      const crosses2 = (c) => inside(c.a) !== inside(c.b);
      const crosses3 = (c) => {
        const n = (inside(c.a) ? 1 : 0) + (inside(c.b) ? 1 : 0) + (inside(c.c) ? 1 : 0);
        return n > 0 && n < 3;
      };
      this.sticks = this.sticks.filter(c => !crosses2(c));
      this.ranges = this.ranges.filter(c => !crosses2(c));
      this.bends = this.bends.filter(c => !crosses3(c));
    }

    // Drop specific constraints, by identity. Used when a blade is pulled
    // back out of a limb.
    removeConstraints(list) {
      const set = new Set(list);
      this.sticks = this.sticks.filter(c => !set.has(c));
      this.ranges = this.ranges.filter(c => !set.has(c));
      this.bends = this.bends.filter(c => !set.has(c));
    }

    unlink(a, b) { a.noCollide.delete(b.id); b.noCollide.delete(a.id); }

    // Delete points and everything referring to them. Used when an item is
    // removed from the scene; the robot never uses this, because a severed
    // limb keeps its points and stays in the world.
    removePoints(set) {
      this.points = this.points.filter(p => !set.has(p));
      const gone2 = (c) => set.has(c.a) || set.has(c.b);
      const gone3 = (c) => set.has(c.a) || set.has(c.b) || set.has(c.c);
      this.sticks = this.sticks.filter(c => !gone2(c));
      this.ranges = this.ranges.filter(c => !gone2(c));
      this.bends = this.bends.filter(c => !gone3(c));
    }

    // Nearest point hit by a ray. Pellets are hitscan rather than fast
    // bodies: a projectile moving hundreds of px per step tunnels straight
    // through a 4px limb, and sub-stepping it would cost more than this.
    raycast(ox, oy, dx, dy, maxDist, filter) {
      let best = null, bestT = maxDist;
      for (const p of this.points) {
        if (filter && !filter(p)) continue;
        const fx = ox - p.x, fy = oy - p.y;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - p.r * p.r;
        const disc = b * b - 4 * c;
        if (disc < 0) continue;
        const s = Math.sqrt(disc);
        let t = (-b - s) / 2;
        if (t < 0) t = (-b + s) / 2;
        if (t < 0 || t > bestT) continue;
        bestT = t; best = p;
      }
      return best ? { point: best, dist: bestT, x: ox + dx * bestT, y: oy + dy * bestT } : null;
    }

    step(dt) {
      const g = this.gravityOn ? this.gravity : 0;
      const damp = this.damping;
      this.contacts.length = 0;
      for (const p of this.points) {
        if (p.invMass === 0) continue;
        const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
        p.px = p.x; p.py = p.y;
        p.x += vx + p.ax * dt * dt;
        p.y += vy + (p.ay + g) * dt * dt;
        p.ax = 0; p.ay = 0;
      }
      for (let i = 0; i < this.iterations; i++) {
        for (const s of this.sticks) s.solve();
        for (const r of this.ranges) r.solve();
        for (const k of this.bends) k.solve();
        for (const fn of this.extras) fn();
        if (this.selfCollide) this.solveSelfCollision();
        this.solveBounds();
        this.solveGrabs();   // last, so the mouse wins
      }
    }

    solveSelfCollision() {
      const pts = this.points;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          if (a.noCollide.has(b.id)) continue;
          // Depth planes only collide with themselves, within one body. In
          // side view an arm passes in front of or behind the torso, never
          // through it -- and treating the torso as solid to its own limbs
          // pinned the far arm behind the back: it could not sweep forward
          // into a guard because the body was in the way. Items and bolts
          // are not on a plane and still hit everything.
          if (a.tag === 'robot' && b.tag === 'robot' && a.depth !== b.depth) continue;
          if (a.depth !== b.depth && a.depth !== 'mid' && b.depth !== 'mid') continue;
          const w = a.invMass + b.invMass;
          if (w === 0) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const target = a.r + b.r;
          const sq = dx * dx + dy * dy;
          if (sq >= target * target || sq === 0) continue;
          const d = Math.sqrt(sq);
          const diff = ((d - target) / d) * 0.5;   // half strength: soft contact
          const ka = a.invMass / w, kb = b.invMass / w;
          a.x += dx * diff * ka; a.y += dy * diff * ka;
          b.x -= dx * diff * kb; b.y -= dy * diff * kb;
        }
      }
    }

    solveBounds() {
      for (const p of this.points) {
        if (p.invMass === 0) continue;
        const sink = p.y + p.r - this.floor;
        if (sink > 0) {
          const vx = p.x - p.px, vy = p.y - p.py;
          // Only the first pass sees the incoming speed; later passes read
          // near zero, so hard hits get reported exactly once.
          if (vy > 1.1) this.contacts.push({ point: p, speed: vy, x: p.x, y: this.floor, nx: 0, ny: -1 });
          p.y -= sink;
          if (vy > 0) p.py = p.y + vy * p.bounce;
          p.px = p.x - vx * (1 - p.friction);
        }
        if (p.x - p.r < 0) {
          const vx = p.x - p.px;
          if (vx < -1.1) this.contacts.push({ point: p, speed: -vx, x: 0, y: p.y, nx: 1, ny: 0 });
          p.x = p.r; p.px = p.x + vx * p.bounce;
        } else if (p.x + p.r > this.width) {
          const vx = p.x - p.px;
          if (vx > 1.1) this.contacts.push({ point: p, speed: vx, x: this.width, y: p.y, nx: -1, ny: 0 });
          p.x = this.width - p.r; p.px = p.x + vx * p.bounce;
        }
        if (p.y - p.r < 0) { const vy = p.y - p.py; p.y = p.r; p.py = p.y + vy * p.bounce; }
      }
    }

    solveGrabs() {
      for (const p of this.points) {
        if (!p.grab) continue;
        p.x += (p.grab.x - p.x) * p.grab.k;
        p.y += (p.grab.y - p.y) * p.grab.k;
      }
    }

    nearest(x, y, radius) {
      let best = null, bestD = radius * radius;
      for (const p of this.points) {
        const dx = p.x - x, dy = p.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }
  }

  PR.Point = Point;
  PR.Stick = Stick;
  PR.Range = Range;
  PR.Bend = Bend;
  PR.World = World;
})(window);
