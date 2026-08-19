/*
  Scene drawing. World units are raster pixels, so there is no transform
  here: point positions are rounded and plotted straight.

  The body is tapered capsules -- round caps are what give a limb weight.
  Drawing order fakes the third dimension: far limbs, then torso and head,
  then near limbs. Segments come from the robot itself, so a limb that has
  been shot off keeps drawing correctly while it tumbles away, and the
  torso is simply left with an empty socket.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const INK    = PR.rgb(47, 47, 47);
  const METAL  = PR.rgb(128, 128, 128);
  const PAPER  = PR.rgb(255, 255, 255);
  const GROUND = PR.rgb(206, 206, 206);
  const CURSOR = PR.rgb(168, 168, 168);
  const HELD   = PR.rgb(214, 64, 64);
  const FLASH  = PR.rgb(250, 214, 120);
  const DBG_A  = PR.rgb(120, 170, 255);
  const DBG_B  = PR.rgb(255, 120, 120);

  // Builds only scale thickness and the depth fade; proportions live in the
  // skeleton, so a build change cannot desync drawing from physics.
  const BUILDS = {
    normal: { mul: 1.00, fade: 0.28 },
    heavy:  { mul: 1.18, fade: 0.28 },
    slim:   { mul: 0.82, fade: 0.28 },
    flat:   { mul: 1.00, fade: 0 }
  };
  PR.styleNames = ['normal', 'heavy', 'slim', 'flat'];

  const FAR_PARTS = { armF: true, legF: true };
  const DRAW_ORDER = ['legF', 'armF', 'core', 'head', 'legN', 'armN'];

  // Near limbs get a 1px paper halo before the ink pass. Without it the
  // front arm and leg dissolve into the torso -- same colour, overlapping
  // shapes -- and the figure reads as one tube.
  const HALO = 1.0;

  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  function unit(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  function drawBolt(raster, x, y, s) {
    raster.disc(x, y, Math.max(1, Math.round(2.1 * s)), METAL);
    raster.plot(Math.round(x), Math.round(y), INK);
  }

  PR.drawRobot = function (raster, robot, styleName, paper) {
    const build = BUILDS[styleName] || BUILDS.normal;
    const s = robot.scale;
    const far = build.fade > 0 ? PR.mix(INK, paper, build.fade) : INK;

    for (const part of DRAW_ORDER) {
      const ink = FAR_PARTS[part] ? far : INK;
      const halo = (part === 'armN' || part === 'legN') ? paper : null;
      for (const seg of robot.segments) {
        if (seg.part !== part) continue;
        const r0 = seg.r0 * build.mul, r1 = seg.r1 * build.mul;
        if (halo) raster.capsule(seg.a.x, seg.a.y, seg.b.x, seg.b.y, r0 + HALO, r1 + HALO, halo);
        raster.capsule(seg.a.x, seg.a.y, seg.b.x, seg.b.y, r0, r1, ink);
      }
      if (part === 'armN' || part === 'armF') {
        const hand = robot.p['hand' + (part === 'armN' ? 'N' : 'F')];
        if (halo) raster.disc(hand.x, hand.y, Math.round(3.9 * s * build.mul + HALO), halo);
        raster.disc(hand.x, hand.y, Math.round(3.9 * s * build.mul), ink);
      }
      if (part === 'head') {
        // Visor slit on the front of the skull, which is what makes the
        // silhouette read as a machine rather than a person.
        const p = robot.p;
        const axis = unit(p.headBase, p.headTop);
        const perp = { x: -axis.y, y: axis.x };
        const c = lerp(p.headBase, p.headTop, 0.58);
        const vx = c.x + perp.x * 3.4 * s, vy = c.y + perp.y * 3.4 * s;
        raster.capsule(vx - axis.x * 2.6 * s, vy - axis.y * 2.6 * s,
                       vx + axis.x * 2.2 * s, vy + axis.y * 2.2 * s,
                       1.7 * s, 1.5 * s, METAL);
      }
    }

    // No pivots or bolts are drawn on an intact body: the silhouette stays
    // as clean as the original design. Damage is the only thing that puts
    // hardware on screen, and then it is on the floor, not on the robot.

    // Attached bolts are deliberately not drawn: they exist on the body and
    // are tracked, but a bolt is only worth seeing once it has been shot
    // loose. Undamaged plating stays clean.
  };

  // Items are drawn twice: once dilated in paper, once for real. A dark
  // handle buried in a dark body is otherwise invisible -- an axe sunk into
  // the head simply vanished -- and this is the same 1px cut the near limbs
  // already use.
  const RING = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

  function shotgunShape(raster, gun, dx, dy, forced) {
    const s = gun.scale;
    const g = { x: gun.grip.x + dx, y: gun.grip.y + dy };
    const m = { x: gun.tip.x + dx, y: gun.tip.y + dy };
    const d = gun.direction();
    const perp = { x: -d.y, y: d.x };
    raster.capsule(g.x - d.x * 9 * s + perp.x * 2.4 * s, g.y - d.y * 9 * s + perp.y * 2.4 * s,
                   g.x, g.y, 2.4 * s, 3.2 * s, forced || INK);
    raster.capsule(g.x, g.y, m.x, m.y, 3.0 * s, 2.1 * s, forced || INK);
    const a = lerp(g, m, 0.52), b = lerp(g, m, 0.78);
    raster.capsule(a.x + perp.x * 2.6 * s, a.y + perp.y * 2.6 * s,
                   b.x + perp.x * 2.6 * s, b.y + perp.y * 2.6 * s, 2.0 * s, 2.0 * s, forced || METAL);
    if (gun.flash > 0 && !forced) {
      const fx = m.x + d.x * 5 * s, fy = m.y + d.y * 5 * s;
      raster.disc(fx, fy, Math.round(3.2 * s), FLASH);
      raster.capsule(fx, fy, fx + d.x * 7 * s, fy + d.y * 7 * s, 2.4 * s, 0.6 * s, FLASH);
      raster.capsule(fx, fy, fx + perp.x * 5 * s, fy + perp.y * 5 * s, 1.6 * s, 0.5 * s, FLASH);
      raster.capsule(fx, fy, fx - perp.x * 5 * s, fy - perp.y * 5 * s, 1.6 * s, 0.5 * s, FLASH);
    }
  }

  function knifeShape(raster, knife, dx, dy, forced) {
    const s = knife.scale;
    const g = { x: knife.grip.x + dx, y: knife.grip.y + dy };
    const t = { x: knife.tip.x + dx, y: knife.tip.y + dy };
    const d = knife.direction();
    const perp = { x: -d.y, y: d.x };
    const guard = lerp(g, t, 0.33), heel = lerp(g, t, 0.36);
    raster.capsule(g.x, g.y, guard.x, guard.y, 3.2 * s, 2.5 * s, forced || INK);
    raster.capsule(guard.x - perp.x * 3 * s, guard.y - perp.y * 3 * s,
                   guard.x + perp.x * 3 * s, guard.y + perp.y * 3 * s, 1.3 * s, 1.3 * s, forced || METAL);
    raster.capsule(heel.x, heel.y, t.x, t.y, 3.0 * s, 0.7 * s, forced || METAL);
    // Dark spine along the back of the blade, so a metal shape on a white
    // page still reads as a blade rather than a smear.
    if (!forced) raster.line(heel.x - perp.x * 1.6 * s, heel.y - perp.y * 1.6 * s,
                             t.x - perp.x * 0.2 * s, t.y - perp.y * 0.2 * s, INK, 1);
  }

  function axeShape(raster, axe, dx, dy, forced) {
    const s = axe.scale;
    const g = { x: axe.grip.x + dx, y: axe.grip.y + dy };
    const t = { x: axe.tip.x + dx, y: axe.tip.y + dy };
    const d = axe.direction();
    const perp = { x: -d.y, y: d.x };
    const at = (along, across) => ({ x: t.x + d.x * along * s + perp.x * across * s,
                                     y: t.y + d.y * along * s + perp.y * across * s });
    raster.capsule(g.x, g.y, t.x - d.x * 3 * s, t.y - d.y * 3 * s, 2.4 * s, 2.2 * s, forced || INK);
    // Single-bit head: the edge flares to one side only, which reads as an
    // axe at this size where a symmetric wedge just reads as a lump.
    raster.fillPolygon([at(-6, -1.5), at(-5.5, -6.5), at(2.5, -7.5), at(4.5, -1), at(1, 2.5), at(-5, 2.5)],
      forced || METAL);
    if (!forced) {
      raster.line(at(-5.5, -6.5).x, at(-5.5, -6.5).y, at(2.5, -7.5).x, at(2.5, -7.5).y, INK, 1);
      raster.line(at(2.5, -7.5).x, at(2.5, -7.5).y, at(4.5, -1).x, at(4.5, -1).y, INK, 1);
    }
  }

  const SHAPES = { shotgun: shotgunShape, knife: knifeShape, axe: axeShape };

  PR.drawItem = function (raster, item) {
    const shape = SHAPES[item.kind] || shotgunShape;
    for (const [dx, dy] of RING) shape(raster, item, dx, dy, PAPER);
    shape(raster, item, 0, 0, null);
  };

  // Over the head, in the same ink as the robot. The halo is not decoration:
  // a robot that has been thrown lands with its head anywhere, and without it
  // the words dissolve into whatever they came down on -- oil, a limb, the
  // floor line. Eight offsets rather than four because a diagonal stroke of
  // the font otherwise still touches the thing behind it.
  const HALO_RING = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

  function drawPlea(raster, robot, text) {
    const width = PR.font.width(text);
    const head = robot.p.headTop;
    // Clamped to the raster, so a long name over a robot standing near the
    // edge is still a whole sentence.
    const x = Math.round(Math.max(1, Math.min(raster.width - width - 1, head.x - width / 2)));
    // headTop is the centre of the head's top ball, not the crown, so its
    // radius has to come off as well -- without it the descenders of "yapma"
    // rest on the skull.
    const y = Math.round(head.y - head.r - PR.font.HEIGHT - 4);
    for (const [dx, dy] of HALO_RING) PR.font.draw(raster, text, x + dx, y + dy, PAPER);
    PR.font.draw(raster, text, x, y, INK);
  }

  PR.draw = function (raster, world, scene, state) {
    raster.clear(PAPER);
    for (let x = 0; x < raster.width; x++) raster.plot(x, world.floor, GROUND);

    scene.fx.drawStains(raster);
    PR.drawRobot(raster, scene.robot, state.style, PAPER);

    // Loose bolts are ordinary world points now, and they are never removed.
    for (const p of world.points) if (p.tag === 'bolt') drawBolt(raster, p.x, p.y, scene.robot.scale);

    for (const item of scene.items) PR.drawItem(raster, item);
    scene.fx.drawDrops(raster);

    // After the items and the oil, so nothing lands on top of the words.
    if (scene.plea && scene.plea.visible()) drawPlea(raster, scene.robot, scene.plea.text());

    if (state.debug) {
      for (const s of world.sticks) raster.line(s.a.x, s.a.y, s.b.x, s.b.y, DBG_A, 1);
      for (const pt of world.points) { raster.circle(pt.x, pt.y, Math.round(pt.r), DBG_B); raster.plot(pt.x, pt.y, DBG_B); }
    }

    if (state.held) raster.circle(state.held.x, state.held.y, 5, HELD);
    else if (state.hover) raster.circle(state.hover.x, state.hover.y, 5, CURSOR);
  };
})(window);
