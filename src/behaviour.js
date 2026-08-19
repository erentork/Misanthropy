/*
  What the robot does about being attacked.

  The body already knows how to hold a pose; this is the part that chooses
  which one. It writes exactly one thing on the robot -- the pose it is
  holding -- so the physics has no idea any of this is happening.

  It does not know it is being hurt on purpose, either. It reads the scene
  the way a body would: something sharp is close, something is pointed at
  me, I have lost a leg. That is the whole mind.

  It does not run away. A servo-driven retreat means dragging the stance
  anchor sideways, and since the servos correct positions while friction
  only acts on velocity, the planted feet slide instead of step -- it
  moonwalked. Standing its ground with its hands up says the same thing and
  says it honestly.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const GUN_REACH = 190;     // a barrel is frightening from across the room
  const BLADE_REACH = 78;    // a blade only once it is nearly on you
  const CALM = 1.4;          // seconds of no threat before the hands come down

  PR.Behaviour = class {
    constructor(robot, world) {
      this.robot = robot;
      this.world = world;
      this.calm = CALM;
      this.scared = false;
      this.urgency = 0;
    }

    // The nearest thing being held that could hurt it, and how alarming it
    // is from here: 0 at the edge of noticing, 1 in your face.
    threat(items) {
      let urgency = 0;
      for (const item of items) {
        if (!item.held() || item.stuck) continue;
        const reach = item.kind === 'shotgun' ? GUN_REACH : BLADE_REACH;
        const chest = this.robot.p.chest;
        const d = Math.hypot(item.tip.x - chest.x, item.tip.y - chest.y);
        if (d > reach) continue;
        const near = 1 - d / reach;
        if (near > urgency) urgency = near;
      }
      return urgency;
    }

    update(dt, items) {
      const robot = this.robot;
      if (robot.state === 'dead') return;

      const urgency = this.threat(items);
      if (urgency > 0) this.calm = 0; else this.calm += dt;
      this.urgency = urgency;
      this.scared = this.calm < CALM;

      // A wounded robot stays curled up whatever else is happening. An
      // unhurt one puts its hands up while something is pointed at it, and
      // only lowers them once nothing has been for a moment -- otherwise the
      // guard flickers every time the cursor drifts out of range.
      if (robot.state === 'wounded') robot.pose = 'cower';
      else robot.pose = this.scared ? 'guard' : 'stand';
    }
  };
})(window);
