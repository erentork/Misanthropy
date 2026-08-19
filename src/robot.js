/*
  Humanoid robot: skeleton, body parts, joint health, bolts.

  Dismemberment drove the layout. Every limb owns the point at its own root
  (shoulder ball, hip ball), so when a joint lets go the limb takes its
  whole capsule with it and the torso keeps a clean socket. Without those
  root points a severed arm would leave its upper half stretched across the
  gap, or lose it entirely.

  The head is two points rather than one for the same reason: a single point
  carries no orientation, so a detached head would have nothing to draw
  along.

  Coordinates: toes at y = 0, up is negative, facing +x.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  // [name, x, y, radius, mass, depth]
  const SKELETON = [
    ['headTop',   6, -104, 8.5, 2.0, 'mid'],
    ['headBase',  3,  -93, 6.0, 1.6, 'mid'],
    ['neck',      2,  -87, 4.5, 2.0, 'mid'],
    ['chest',     2,  -80, 6.5, 4.0, 'mid'],
    ['waist',     1,  -69, 6.0, 3.5, 'mid'],
    ['hip',       0,  -58, 6.5, 4.5, 'mid'],

    ['shoulderN', 3,  -79, 4.5, 2.0, 'near'],
    ['elbowN',    3,  -68, 4.0, 1.4, 'near'],
    ['handN',     9,  -54, 3.5, 1.1, 'near'],
    ['hipN',      1,  -57, 4.5, 2.0, 'near'],
    ['kneeN',     7,  -32, 5.0, 2.5, 'near'],
    ['ankleN',   10,   -5, 4.0, 1.6, 'near'],
    ['toeN',     18,   -3, 3.0, 0.7, 'near'],

    ['shoulderF', 0,  -79, 4.5, 2.0, 'far'],
    ['elbowF',   -4,  -68, 4.0, 1.4, 'far'],
    ['handF',    -7,  -54, 3.5, 1.1, 'far'],
    ['hipF',     -1,  -57, 4.5, 2.0, 'far'],
    ['kneeF',    -4,  -31, 5.0, 2.5, 'far'],
    ['ankleF',  -11,   -6, 4.0, 1.6, 'far'],
    ['toeF',     -3,   -4, 3.0, 0.7, 'far']
  ];

  // Curled on the ground: knees tucked, back folded over, hands up by the
  // head. The stance servos aim at whichever pose is current, so being hurt
  // is a change of target rather than a separate system.
  const COWER = [
    ['headTop',  10, -40], ['headBase', 7, -32], ['neck',   5, -27],
    ['chest',     3, -22], ['waist',    0, -18], ['hip',   -4, -14],
    ['shoulderN', 4, -22], ['elbowN',  11, -26], ['handN', 10, -35],
    ['hipN',     -3, -13], ['kneeN',    8, -14], ['ankleN', 10, -4], ['toeN', 16, -3],
    ['shoulderF', 1, -22], ['elbowF',   8, -26], ['handF',  7, -35],
    ['hipF',     -5, -13], ['kneeF',    5, -15], ['ankleF',  6, -4], ['toeF', 12, -3]
  ];

  // Both hands up and the head tucked forward into them. The two hands are
  // staggered on purpose -- one at the face, one just below and behind it.
  // Stacked at the same height they land on top of each other in profile and
  // only one is visible, and any nearer the body they collide with the neck
  // and get shoved back down. Both targets keep the real bone lengths: an
  // earlier version asked for arms 20% shorter than they are, the rigid
  // bones pushed back exactly as hard as the servo pulled, and the far arm
  // never moved off the robot's side at all. The arms cannot go higher than this and stay honest: the upper arm
  // is 11px and the forearm 15px, so with the elbow kept down where a guard
  // needs it, the hands top out just under the jaw. Everything below the
  // shoulders is exactly the standing pose,
  // which is deliberate: the guard reads entirely through the arms, and
  // leaving the spine and legs alone means the pose cannot fight the bone
  // lengths or the joint limits it has to live inside.
  const GUARD = [
    ['headTop',   9, -102], ['headBase', 4, -92], ['neck',   2, -87],
    ['chest',     2,  -80], ['waist',    1, -69], ['hip',    0, -58],
    ['shoulderN', 3,  -79], ['elbowN',  11, -72], ['handN', 12, -87],
    ['hipN',      1,  -57], ['kneeN',    7, -32], ['ankleN', 10, -5], ['toeN', 18, -3],
    ['shoulderF', 0,  -79], ['elbowF',   5, -69], ['handF',  8, -83],
    ['hipF',     -1,  -57], ['kneeF',   -4, -31], ['ankleF', -11, -6], ['toeF', -3, -4]
  ];

  // [id, from, to, radius at from, radius at to, part]
  const SEGMENTS = [
    ['torsoLow',  'hip',       'waist',     7.5, 7.0, 'core'],
    ['torsoMid',  'waist',     'chest',     7.0, 7.5, 'core'],
    ['torsoTop',  'chest',     'neck',      7.5, 4.5, 'core'],
    ['head',      'headBase',  'headTop',   6.0, 9.5, 'head'],

    ['upperN',    'shoulderN', 'elbowN',    5.4, 4.4, 'armN'],
    ['foreN',     'elbowN',    'handN',     4.4, 3.4, 'armN'],
    ['thighN',    'hipN',      'kneeN',     7.0, 5.4, 'legN'],
    ['shinN',     'kneeN',     'ankleN',    5.4, 4.2, 'legN'],
    ['footN',     'ankleN',    'toeN',      4.2, 3.0, 'legN'],

    ['upperF',    'shoulderF', 'elbowF',    5.4, 4.4, 'armF'],
    ['foreF',     'elbowF',    'handF',     4.4, 3.4, 'armF'],
    ['thighF',    'hipF',      'kneeF',     7.0, 5.4, 'legF'],
    ['shinF',     'kneeF',     'ankleF',    5.4, 4.2, 'legF'],
    ['footF',     'ankleF',    'toeF',      4.2, 3.0, 'legF']
  ];

  const PARTS = {
    core: ['neck', 'chest', 'waist', 'hip'],
    head: ['headBase', 'headTop'],
    armN: ['shoulderN', 'elbowN', 'handN'],
    armF: ['shoulderF', 'elbowF', 'handF'],
    legN: ['hipN', 'kneeN', 'ankleN', 'toeN'],
    legF: ['hipF', 'kneeF', 'ankleF', 'toeF']
  };

  // Breakable joints. There is no list of what holds each one on: breaking
  // calls world.detach(), which drops every constraint crossing the part
  // boundary, so mounts, limits and swing ranges all go at once.
  const JOINTS = [
    { id: 'neck',      part: 'head', pivot: 'headBase' },
    { id: 'shoulderN', part: 'armN', pivot: 'shoulderN' },
    { id: 'shoulderF', part: 'armF', pivot: 'shoulderF' },
    { id: 'hipN',      part: 'legN', pivot: 'hipN' },
    { id: 'hipF',      part: 'legF', pivot: 'hipF' }
  ];

  // Bolts sit at the joints they hold together, plus a few on the plating.
  // A fixed roster, because they are meant to be countable: once one drops
  // it is gone from the body for good.
  // [id, segment, t along it, offset across it]
  const BOLTS = [
    ['shoulder-n', 'upperN', 0.00, 0], ['elbow-n', 'foreN', 0.00, 0],
    ['hip-n',      'thighN', 0.00, 0], ['knee-n',  'shinN', 0.00, 0], ['ankle-n', 'footN', 0.00, 0],
    ['shoulder-f', 'upperF', 0.00, 0], ['elbow-f', 'foreF', 0.00, 0],
    ['hip-f',      'thighF', 0.00, 0], ['knee-f',  'shinF', 0.00, 0], ['ankle-f', 'footF', 0.00, 0],
    ['plate-1',    'torsoMid', 0.30, -4.0], ['plate-2', 'torsoMid', 0.30, 4.0],
    ['plate-3',    'torsoLow', 0.55, -4.0], ['plate-4', 'torsoLow', 0.55, 4.0],
    ['crown-1',    'head', 0.70, -5.0], ['crown-2', 'head', 0.70, 5.0]
  ];

  const SIDES = ['N', 'F'];
  // Impacts below this speed (px per substep) only leak oil; above it they
  // start doing structural damage, scaled so a hard throw into a wall can
  // tear a limb but a stumble cannot.
  const CONTACT_SPEED = 1.8;   // px per substep before a contact is reported
  const CONTACT_GAP = 0.14;    // seconds between reports from one point
  const KNOCK_SPEED = 0.9;     // px per substep of body motion that fells it
  const SETTLE_SPEED = 0.55;   // below this, a downed robot counts as lying still
  const RISE_GRACE = 1.5;      // seconds it is allowed to move while getting up
  const STAND_HIP = 57;        // hip height above the floor when upright
  const GROUND_GAP = 4;        // px of clearance still counted as standing on it
  const AIR_GRACE = 0.12;      // seconds off the floor before that counts as a fall
  const RISE_KNOCK = 2.6;      // only a real blow interrupts a robot getting up
  const STAND_SPEED = 105;     // px per second while pushing itself upright
  const MAX_STEP = 0.05;       // px a servo may move one point in one pass
  const IMPACT_FLOOR = 5.5;    // speed a contact must beat to do structural harm
  const IMPACT_DAMAGE = 5;
  const IMPACT_CAP = 20;       // one landing can only do so much
  const IMPACT_MIN = 4;        // glancing hits do nothing rather than adding up
  const DAMAGE_GAP = 0.6;      // seconds before the same point can be hurt again

  PR.buildRobot = function (world, ox, oy, opts) {
    opts = opts || {};
    const s = opts.scale !== undefined ? opts.scale : 1;
    const tone = opts.tone !== undefined ? opts.tone : 0.012;
    const p = {};

    for (const [name, x, y, r, mass, depth] of SKELETON) {
      const pt = world.add(new PR.Point(ox + x * s, oy + y * s, {
        r: r * s, invMass: 1 / mass, depth: depth,
        friction: name.startsWith('toe') || name.startsWith('ankle') ? 0.6 : 0.35
      }));
      pt.tag = 'robot';
      pt.name = name;
      p[name] = pt;
    }

    const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
    // Which side of the a-to-c axis b sits on, read off the rest pose. This
    // is what locks each hinge to its anatomical direction.
    const side = (a, b, c) => {
      const ex = c.x - a.x, ey = c.y - a.y;
      return Math.sign(ex * (b.y - a.y) - ey * (b.x - a.x)) || 1;
    };

    // Spine.
    world.stick(p.neck, p.chest);
    world.stick(p.chest, p.waist);
    world.stick(p.waist, p.hip);
    world.range(p.neck, p.waist, len(p.neck, p.waist) * 0.84, len(p.neck, p.waist));
    world.range(p.chest, p.hip, len(p.chest, p.hip) * 0.82, len(p.chest, p.hip));

    // Neck. Two mounts plus the skull bone would make a rigid triangle,
    // which is what a bolted-on head ought to be -- but it welds the head to
    // the torso, and grabbing the head then swings the entire body as one
    // board. One mount plus a range on neck-to-crown gives a real joint with
    // roughly 45 degrees of tilt either way, which is what makes dragging
    // the robot around feel like a body instead of a mannequin.
    world.stick(p.headBase, p.headTop);
    world.stick(p.neck, p.headBase);
    world.range(p.neck, p.headTop, len(p.neck, p.headTop) * 0.93, len(p.neck, p.headTop));

    for (const t of SIDES) {
      const shoulder = p['shoulder' + t], elbow = p['elbow' + t], hand = p['hand' + t];
      const hipJ = p['hip' + t], knee = p['knee' + t], ankle = p['ankle' + t], toe = p['toe' + t];

      world.stick(p.chest, shoulder); world.stick(p.neck, shoulder);
      world.stick(p.hip, hipJ); world.stick(p.waist, hipJ);

      world.stick(shoulder, elbow); world.stick(elbow, hand);
      world.stick(hipJ, knee); world.stick(knee, ankle); world.stick(ankle, toe);

      const arm = len(shoulder, elbow) + len(elbow, hand);
      world.range(shoulder, hand, arm * 0.32, arm * 0.97);
      world.bend(shoulder, elbow, hand, side(shoulder, elbow, hand), 2.5 * s);

      const leg = len(hipJ, knee) + len(knee, ankle);
      world.range(hipJ, ankle, leg * 0.38, leg * 0.97);
      world.bend(hipJ, knee, ankle, side(hipJ, knee, ankle), 2.5 * s);

      world.range(knee, toe, len(knee, toe) * 0.82, len(knee, toe) * 1.06);
      world.bend(knee, ankle, toe, side(knee, ankle, toe), 1.5 * s);

      // An arm and the leg below it are on the same fake depth plane, so the
      // point-circle proxy has them colliding -- and the far hand, which
      // hangs behind the hip, could not sweep forward into a guard because
      // its own hip was in the way. A real shoulder and hip are not in the
      // same plane; the joint limits already stop the arm going anywhere it
      // should not.
      for (const armPt of [shoulder, elbow, hand])
        for (const legPt of [hipJ, knee, ankle, toe]) world.link(armPt, legPt);

      // Swing limits. These cross the joint boundary, so detach() drops
      // them automatically when the limb comes off.
      world.range(p.chest, knee, len(p.chest, knee) * 0.58, len(p.chest, knee) * 1.24);
      // Wide enough for the guard: at 1.30 the elbow could not come up in
      // front of the face at all, and at 1.60 the hands only reached the chin.
      world.range(p.hip, elbow, len(p.hip, elbow) * 0.50, len(p.hip, elbow) * 1.80);
    }

    if (tone > 0) {
      // Legs only. An arm tone spring pulls the hand out to full extension,
      // which is twice as strong as the arm servo and quietly beat every
      // bent-arm pose: the guard came out as two straight arms pointing up,
      // and the far one never left the robot's side at all.
      for (const t of SIDES) world.stick(p['hip' + t], p['ankle' + t], { stiffness: tone });
    }

    const segments = SEGMENTS.map(([id, a, b, r0, r1, part]) =>
      ({ id, a: p[a], b: p[b], r0: r0 * s, r1: r1 * s, part }));
    const segmentById = {};
    for (const seg of segments) segmentById[seg.id] = seg;

    const partPoints = {};
    const partOf = new Map();
    for (const name in PARTS) {
      partPoints[name] = new Set(PARTS[name].map(n => p[n]));
      for (const pt of partPoints[name]) partOf.set(pt, name);
    }

    const joints = JOINTS.map(j => ({ id: j.id, part: j.part, pivot: p[j.pivot], hp: 1, maxHp: 1, broken: false }));
    const jointOfPart = {};
    for (const j of joints) jointOfPart[j.part] = j;

    const bolts = BOLTS.map(([id, segId, t, off]) =>
      ({ id, seg: segmentById[segId], t, off: off * s, attached: true }));

    // Rest pose relative to the hip, for the servos below.
    const hipRest = SKELETON.find(r => r[0] === 'hip');
    const offsetsFrom = (table) => {
      const out = {};
      for (const [name, x, y] of table) out[name] = { dx: (x - hipRest[1]) * s, dy: (y - hipRest[2]) * s };
      return out;
    };
    const POSES = { stand: offsetsFrom(SKELETON), guard: offsetsFrom(GUARD), cower: offsetsFrom(COWER) };
    // What the servos are actually aiming at right now: eased towards the
    // chosen pose rather than switched, or the robot snaps between shapes.
    const live = {};
    for (const name in POSES.stand) live[name] = { dx: POSES.stand[name].dx, dy: POSES.stand[name].dy };
    // How hard each point is held to the rest pose. Arms stay loose so they
    // still swing when the body is shoved; the legs and spine carry it.
    // Arms are held firmly enough to hold a pose now that nothing else is
    // pulling them straight; being grabbed already slackens everything.
    const SERVO = { armN: 0.7, armF: 0.7, head: 0.6, core: 1, legN: 1, legF: 1 };
    // Feet are held a little softer than the rest, so the planted foot can
    // still settle into the ground contact instead of fighting it.
    const SERVO_FREE = { ankleN: 0.7, ankleF: 0.7, toeN: 0.55, toeF: 0.55 };

    const robot = {
      p, segments, joints, bolts, partPoints, partOf, jointOfPart, scale: s, world,
      leaks: [],
      // 'ok' stands and backs away, 'wounded' has lost a limb and curls up
      // on the floor, 'dead' is a plain ragdoll. Losing one limb no longer
      // kills: finishing it off is left as something the player chooses.
      state: 'ok',
      alive: true,
      broken: 0,
      poses: POSES,
      offsets: live,
      pose: 'stand',
      poseRate: 3.5,       // how fast the body eases between poses
      flinchTime: 0,
      down: false,        // knocked off its feet and still getting back up
      rising: 0,          // grace window while standing back up
      airTime: 0,         // how long it has been off the floor
      downTime: 0,
      getUpDelay: 0.6,
      stance: 0.024,       // servo pull per constraint pass
      limpWhenHeld: 0.2,   // servos back off to this while the mouse holds it
      power: 1,            // eased towards limpWhenHeld / 1, never snapped
      home: null,      // world x the stance holds; follows the mouse while held

      grabbed() {
        for (const name in this.p) if (this.p[name].grab) return true;
        return false;
      },

      // A balance controller has nothing to push against in mid-air, and
      // leaving it on there is what made the robot impossible to throw: let
      // go mid-swing and the servos plus the world anchor simply stopped it
      // dead. Off the ground it is a plain ragdoll.
      //
      // The clearance matters: a standing robot floats about 2px clear of the
      // floor because the servos hold it there, so a 1.5px test had it
      // permanently airborne, and it collapsed every time it lowered its
      // guard.
      grounded() {
        const f = this.world.floor;
        for (const name in this.p) if (this.p[name].y + this.p[name].r >= f - GROUND_GAP) return true;
        return false;
      },

      // Bolt position is derived from its segment, so it tracks the limb
      // while attached and only becomes a body of its own once it drops.
      boltPos(bolt) {
        const a = bolt.seg.a, b = bolt.seg.b;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        return {
          x: a.x + dx * bolt.t - (dy / d) * bolt.off,
          y: a.y + dy * bolt.t + (dx / d) * bolt.off
        };
      },

      // Servos. A limp robot is a pile on the floor, which is useless as a
      // target, so while it is intact every point is pulled towards the rest
      // pose anchored over whatever feet it still has. Losing a joint cuts
      // the power, and it drops -- the same rule as a body going limp.
      balance() {
        if (!this.alive || this.rising > 0) return;
        // Shape matching: pull the intact body towards the upright rest pose
        // centred on its own centre of mass, so the correction sums to zero
        // and adds no net force. Anchoring the pose to the feet instead --
        // the obvious version -- makes the servo lift the body by its own
        // bootstraps: gravity sags the spine, the servo pulls every point
        // back up, the feet follow through the bones, and the robot climbs
        // off the top of the screen in about a second. Standing up is then
        // left to what actually does it in reality: gravity, the floor, and
        // foot friction.
        let sum = 0, cx = 0, cy = 0, rx = 0, ry = 0;
        const moving = [];
        for (const name in this.p) {
          const pt = this.p[name];
          const part = this.partOf.get(pt);
          const joint = part && this.jointOfPart[part];
          if (joint && joint.broken) continue;
          const weight = SERVO_FREE[name] !== undefined ? SERVO_FREE[name] : (SERVO[part] || 1);
          if (weight === 0) continue;
          const k = this.stance * this.power * weight;
          const w = k / pt.invMass;                 // mass times servo strength
          const o = this.offsets[name];
          const ox = o.dx, oy = o.dy;
          sum += w; cx += w * pt.x; cy += w * pt.y; rx += w * ox; ry += w * oy;
          moving.push({ pt, k, ox, oy });
        }
        if (sum === 0) return;
        cx /= sum; cy /= sum; rx /= sum; ry /= sum;

        // Horizontal anchor. Shape matching alone conserves momentum but
        // still creeps: it corrects positions, and friction only ever acts
        // on velocity, so every pass slides the planted feet a fraction of
        // a pixel and the robot moonwalks across the screen. Holding one
        // world x is what a servo standing its ground actually does. Only x
        // is anchored -- anchoring y as well is what made it levitate.
        if (this.home === null || this.grabbed() || this.power < 0.9) this.home = cx;
        const ax = this.home;

        // A servo has a maximum force. Without this cap, standing up from
        // lying down is a 50px correction applied in one pass, and since a
        // positional correction is also an injection of velocity, the robot
        // fires itself off the floor instead of rising.
        // While getting up, the vertical anchor comes from the floor rather
        // than from the body's own centre. Shape matching around the centre
        // of a body lying down puts the target feet below the floor, and the
        // floor answers by squeezing the robot back out -- which is why it
        // kept firing itself into the air instead of standing. Only during
        // the rise: holding y all the time is what makes it levitate.
        let ay = cy;
        if (this.rising > 0 && !this.down) ay = world.floor - STAND_HIP * s + ry;

        const limit = MAX_STEP * s;
        for (const { pt, k, ox, oy } of moving) {
          let mx = (ax + ox - rx - pt.x) * k;
          let my = (ay + oy - ry - pt.y) * k;
          const mag = Math.hypot(mx, my);
          if (mag > limit) { const f = limit / mag; mx *= f; my *= f; }
          pt.x += mx;
          pt.y += my;
          // Light drag while powered, so the pose settles instead of ringing.
          const vx = pt.x - pt.px, vy = pt.y - pt.py;
          pt.px += vx * k * 0.35; pt.py += vy * k * 0.35;
        }
      },

      setDurability(level) {
        this.durability = level;
        const hp = 9 * level;
        for (const j of this.joints) { j.maxHp = hp; if (!j.broken) j.hp = hp; }
      },

      popBolt(bolt, world, vx, vy) {
        if (!bolt.attached) return null;
        bolt.attached = false;
        const at = this.boltPos(bolt);
        const pt = world.add(new PR.Point(at.x, at.y, {
          r: 2.2 * this.scale, invMass: 1 / 0.45, friction: 0.7, bounce: 0.25
        }));
        pt.tag = 'bolt';
        pt.setVelocity((vx || 0) + (Math.random() - 0.5) * 1.6, (vy || 0) - Math.random() * 1.4);
        return pt;
      },

      // Nearest still-attached bolt, so a hit can knock one loose.
      nearestBolt(x, y, radius) {
        let best = null, bestD = radius * radius;
        for (const b of this.bolts) {
          if (!b.attached) continue;
          const at = this.boltPos(b);
          const d = (at.x - x) * (at.x - x) + (at.y - y) * (at.y - y);
          if (d < bestD) { bestD = d; best = b; }
        }
        return best;
      },

      breakJoint(joint, world, fx) {
        if (joint.broken) return;
        joint.broken = true;
        joint.hp = 0;
        this.broken++;
        if (this.onBreak) this.onBreak(joint.id);
        // The head is not survivable; a second limb is not either. One limb
        // leaves it alive and curled up, which is the whole point: whether it
        // dies is then a decision rather than a side effect.
        this.state = (joint.part === 'head' || this.broken >= 2) ? 'dead' : 'wounded';
        this.alive = this.state !== 'dead';
        if (this.state === 'wounded') { this.pose = 'cower'; this.flinchTime = 0.5; }
        world.detach(this.partPoints[joint.part]);

        // Only the bolts that were actually holding this joint let go. The
        // roster is small and never replenished, so shedding half of it on
        // one break would strip the robot bare in two shots.
        const pivot = joint.pivot;
        let popped = 0;
        for (const bolt of this.bolts) {
          if (!bolt.attached || popped >= 3) continue;
          const at = this.boltPos(bolt);
          if (Math.hypot(at.x - pivot.x, at.y - pivot.y) < 11 * this.scale) {
            this.popBolt(bolt, world, pivot.vx * 0.5, pivot.vy * 0.5);
            popped++;
          }
        }
        if (fx) {
          fx.spray(pivot.x, pivot.y, pivot.vx * 0.3, pivot.vy * 0.3 - 0.6, 26, 2.2);
          fx.shake(4.5);
          fx.sound('tear');
        }
        // A torn joint keeps dripping for a while afterwards.
        this.leaks.push({ point: pivot, left: 6 + Math.random() * 4, timer: 0 });
      },

      // Every source of harm goes through here: buckshot, a knife, or the
      // robot being slammed into a wall. Damage always lands on the joint
      // that owns whatever was struck, so a limb comes off where it was hit.
      // Returns true if this took the limb off.
      damage(world, fx, target, amount) {
        // Flinch first. The torso is the biggest thing to hit and has no
        // breakable joint, so doing this after the joint lookup meant body
        // shots -- most shots -- were felt by nothing at all.
        this.flinch(amount);
        if (this.onDamage) this.onDamage(amount, this.state);
        const part = this.partOf.get(target);
        const joint = part && this.jointOfPart[part];
        if (!joint || joint.broken) return false;
        joint.hp -= amount;
        if (joint.hp <= 0) { this.breakJoint(joint, world, fx); return true; }
        return false;
      },

      // Standing up is driven, not sprung. Shape matching cannot do it: from
      // a body lying down the target feet sit below the floor, the floor
      // answers by squeezing, and the robot fires itself into the air -- and
      // softening the servo enough to stop that left it unable to rise at
      // all (3 successes in 15 throws). So for the second and a half it is
      // getting up, each point is walked towards its standing place at a
      // fixed speed, carrying its previous position along so the move adds
      // no momentum, with gravity bled off as it goes.
      standUp(dt) {
        const stand = this.poses.stand;
        let sum = 0, rx = 0, ry = 0;
        for (const name in this.p) {
          const part = this.partOf.get(this.p[name]);
          const joint = part && this.jointOfPart[part];
          if (joint && joint.broken) continue;
          const w = 1 / this.p[name].invMass;
          sum += w; rx += w * stand[name].dx; ry += w * stand[name].dy;
        }
        if (sum === 0) return;
        rx /= sum; ry /= sum;
        const ax = this.home === null ? this.p.hip.x : this.home;
        const ay = this.world.floor - STAND_HIP * this.scale + ry;
        const reach = STAND_SPEED * this.scale * dt;

        for (const name in this.p) {
          const pt = this.p[name];
          const part = this.partOf.get(pt);
          const joint = part && this.jointOfPart[part];
          if (joint && joint.broken) continue;
          const o = stand[name];
          const dx = (ax + o.dx - rx) - pt.x, dy = (ay + o.dy - ry) - pt.y;
          const d = Math.hypot(dx, dy);
          if (d < 0.01) continue;
          const f = Math.min(1, reach / d);
          pt.moveTo(pt.x + dx * f, pt.y + dy * f);
          pt.px += (pt.x - pt.px) * 0.3;    // shed what gravity keeps adding
          pt.py += (pt.y - pt.py) * 0.3;
        }
      },

      // An involuntary jerk: the servos falter for a moment, so a hit reads
      // as felt rather than as a shove.
      flinch(amount) {
        if (this.state === 'dead') return;
        this.flinchTime = Math.max(this.flinchTime, Math.min(0.4, 0.12 + amount * 0.012));
      },

      // A pellet landed.
      hit(world, fx, target, x, y, dx, dy, amount) {
        fx.spray(x, y, dx * 1.4 + (Math.random() - 0.5), dy * 1.4 - 0.5, 9, 1.7);
        fx.sound('pellet');
        const bolt = this.nearestBolt(x, y, 11 * this.scale);
        if (bolt && Math.random() < 0.45) this.popBolt(bolt, world, dx * 1.5, dy * 1.5 - 0.5);
        return this.damage(world, fx, target, amount);
      },

      // Slammed into the floor or a wall. Same joint bookkeeping as a bullet,
      // so throwing the robot hard enough at a wall tears the limb that hit.
      impact(world, fx, target, speed, x, y, nx, ny) {
        const bolt = this.nearestBolt(x, y, 13 * this.scale);
        if (bolt && Math.random() < 0.3) this.popBolt(bolt, world, nx * 1.2, ny * 1.2 - 0.6);
        // A tumbling robot lands over and over. Without a floor under the
        // amount, those taps accumulate and shake it apart even at high
        // armour, so anything short of a real slam is ignored outright.
        const amount = Math.min(IMPACT_CAP, (speed - IMPACT_FLOOR) * IMPACT_DAMAGE);
        if (amount < IMPACT_MIN) return false;
        return this.damage(world, fx, target, amount);
      },

      // Every floor and wall contact the solver reported this step. Hard
      // enough springs a leak; harder still does structural damage, so
      // throwing the robot at a wall can tear off whatever hit it. Lives
      // here rather than in the loop so the rule is testable on its own.
      handleContacts(world, fx, clock) {
        for (const c of world.contacts) {
          if (c.point.tag !== 'robot' || c.speed < CONTACT_SPEED) continue;
          if (clock - (c.point.lastContact || -1) < CONTACT_GAP) continue;
          c.point.lastContact = clock;
          const power = Math.min(2.4, c.speed * 0.5);
          fx.spray(c.x, c.y, c.nx * 0.4, c.ny * 0.5, Math.round(4 + power * 4), power);
          fx.shake(Math.min(3, c.speed * 0.6));
          fx.sound('thud', { power: power });
          // Damage is rarer than oil and needs a harder hit. A tumbling body
          // makes a lot of contacts, and letting each one bite tore the robot
          // apart the moment it touched a wall.
          if (c.speed <= IMPACT_FLOOR) continue;
          if (clock - (c.point.lastDamage || -1) < DAMAGE_GAP) continue;
          c.point.lastDamage = clock;
          this.impact(world, fx, c.point, c.speed, c.x, c.y, c.nx, c.ny);
        }
      },

      // A blade went in and stayed. Its points join the limb's part set, so
      // if that limb is later shot off the knife rides away still stuck in
      // it -- detach() only drops constraints crossing the part boundary.
      embed(part, points) {
        const set = this.partPoints[part];
        if (!set) return;
        for (const pt of points) set.add(pt);
      },

      release(points) {
        for (const name in this.partPoints)
          for (const pt of points) this.partPoints[name].delete(pt);
      },

      update(dt, fx) {
        // Grabbing has to feel like dragging a body, not a mannequin, so the
        // servos fade out while the mouse holds on and fade back in after --
        // switching them instantly makes the robot snap upright on release.
        // Knocked off its feet counts the same as being in the air. Without
        // this the anchor braked a shoved robot to a stop before it ever
        // reached the wall, so it could never be slammed into anything.
        const hit = Math.hypot(this.p.hip.vx + this.p.chest.vx, this.p.hip.vy + this.p.chest.vy) * 0.5;

        // Ease the body towards whichever pose it is holding.
        const want = this.poses[this.pose] || this.poses.stand;
        const ease = Math.min(1, dt * this.poseRate);
        for (const name in this.offsets) {
          const o = this.offsets[name], target2 = want[name];
          o.dx += (target2.dx - o.dx) * ease;
          o.dy += (target2.dy - o.dy) * ease;
        }

        // Getting up takes a moment of lying there first, and the wait is
        // different every time, so it reads as effort rather than a spring.
        //
        // The delay only applies to a robot that has actually been knocked
        // down. Gating every standing robot on it deadlocks: power drops
        // while the timer runs, an unpowered body starts to fall, falling
        // counts as not steady, the timer resets, and it never stands again.
        // Being knocked down and getting back up need different tests. Once
        // it is down, its own effort to rise is motion too, and re-arming on
        // that leaves it thrashing on the floor forever: power comes back, it
        // starts to lift, the lift reads as a knock, power cuts, it drops.
        // So only leaving the ground -- or a real shove while it is standing
        // -- puts it down; recovery is timed from the floor.
        const onFloor = this.grounded();
        // Rising is itself violent motion, and without a grace window it
        // trips the knock test the instant the servos take hold: it lifts,
        // the lift reads as a shove, it drops, and the whole cycle repeats
        // about once a second forever.
        if (this.rising > 0) this.rising -= dt;
        // Mid-rise the body is legitimately in motion and part of it is off
        // the floor, so both ordinary knock tests would fire. Only a real
        // blow interrupts a robot that is trying to stand.
        const risingNow = this.rising > 0;
        // Leaving the floor only counts once it has lasted. Changing pose
        // shifts the balance enough to bob the feet clear for a frame or
        // two, and treating that as a knock made the robot drop and have to
        // stand up again every time it lowered its guard.
        if (onFloor) this.airTime = 0; else this.airTime += dt;
        const airborne = this.airTime > AIR_GRACE;
        const felled = risingNow ? hit > RISE_KNOCK : (airborne || hit > KNOCK_SPEED);
        if (!this.down && felled) {
          this.down = true;
          this.downTime = 0;
          this.getUpDelay = 0.45 + Math.random() * 0.9;
        } else if (this.down) {
          // Credit towards standing is earned while lying still and lost
          // gradually while being tossed about -- not reset. A body that has
          // just been thrown bounces and rolls for seconds, and restarting
          // the count on every bounce leaves it thrashing on the floor
          // forever, never quite settling long enough to try.
          if (onFloor && hit < SETTLE_SPEED) this.downTime += dt;
          else this.downTime = Math.max(0, this.downTime - dt * 0.5);
          if (this.downTime > this.getUpDelay) { this.down = false; this.rising = RISE_GRACE; }
        }
        const upright = !this.down;

        if (this.flinchTime > 0) this.flinchTime -= dt;
        const hurt = this.flinchTime > 0 ? 0.35 : 1;
        const wounded = this.state === 'wounded' ? 0.55 : 1;

        // Only an unhurt robot tries to stand. A wounded one holds the cower
        // pose, and letting the get-up routine walk it towards the standing
        // pose at the same time makes the two fight: it rises, shakes, drops,
        // rises again, over and over. Blocking the attempt is enough --
        // marking it permanently down as well cut the servo power too, and
        // then it could not hold the curl either and just lay there flat.
        if (risingNow && !this.grabbed() && this.state === 'ok') this.standUp(dt);

        const target = this.grabbed() ? this.limpWhenHeld : (upright ? hurt * wounded : 0);
        // Cutting power is instant so a throw is never fought. Restoring it
        // is slow -- a stagger, not a snap -- except while actually pushing
        // itself off the floor, which needs the servos at strength or the
        // robot never leaves the ground.
        const rate = target < this.power ? 25 : (risingNow ? 7 : 2.5);
        this.power += (target - this.power) * Math.min(1, dt * rate);

        for (let i = this.leaks.length - 1; i >= 0; i--) {
          const leak = this.leaks[i];
          leak.left -= dt;
          leak.timer -= dt;
          if (leak.timer <= 0) {
            leak.timer = 0.05 + Math.random() * 0.09;
            fx.spray(leak.point.x, leak.point.y, 0, 0.2, 1, 0.35);
          }
          if (leak.left <= 0) this.leaks.splice(i, 1);
        }
      }
    };

    robot.setDurability(opts.durability || 3);
    world.extras.push(() => robot.balance());
    return robot;
  };
})(window);
