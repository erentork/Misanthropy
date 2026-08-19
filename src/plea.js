/*
  The robot says the player's name.

  Up to now the game has only ever spoken to the player between robots, on a
  black screen, in the voice of whoever is running the experiment. This is the
  other direction: one of the things being taken apart, using the name that
  was typed into the intake form, while it is still standing there.

  It arrives on the fifth robot -- late enough that the player has a habit by
  then, early enough that there are fifteen more to do it in front of. After
  that it is rare and unannounced, so it never becomes a mechanic to expect.

  Two lines, chosen at random, both unfinished. A whole sentence would be the
  game arguing with the player; a trailing one is just something that did not
  get to the end.

  It blinks rather than sits there, on an irregular pattern with one hold in
  the middle long enough to read once. Steady text is a label and gets
  ignored; text that is gone before you are sure you saw it gets read twice.
  Nothing here is a mechanic: it cannot be dismissed, it changes no number,
  and the robot goes on behaving exactly as it did.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const FIRST = 5;     // the robot that always speaks
  const LAST = 20;     // past this the record is being offered instead
  const CHANCE = 0.2;  // for every robot in between

  const LINES = ['plea.dont', 'plea.stop'];

  // [visible, seconds]. A stutter in, one readable hold, a stutter out, and
  // then it is gone for that robot for good. The waiting row at the front
  // matters: it lets the player look at the robot first, so the words arrive
  // on something they were already watching.
  const BLINK = [
    [false, 1.10],
    [true, 0.05], [false, 0.09],
    [true, 0.05], [false, 0.07],
    [true, 1.15],
    [false, 0.32],
    [true, 0.10], [false, 0.12],
    [true, 0.45]
  ];

  class Plea {
    constructor(key) {
      this.key = key;
      this.time = 0;
      this.step = 0;
      this.done = false;
    }

    // alive is passed in rather than read off a robot, so this can be driven
    // without a scene. A dead one stops mid-word, which is the correct amount
    // of ceremony for it.
    update(dt, alive) {
      if (this.done) return;
      if (alive === false) { this.done = true; return; }
      this.time += dt;
      while (this.step < BLINK.length && this.time >= BLINK[this.step][1]) {
        this.time -= BLINK[this.step][1];
        this.step++;
      }
      if (this.step >= BLINK.length) this.done = true;
    }

    visible() { return !this.done && BLINK[this.step][0]; }

    // Resolved at draw time, not at construction, so switching language part
    // way through changes the words rather than leaving a stale sentence.
    text() { return PR.i18n.t(this.key, { name: PR.candidate.name }); }
  }

  PR.Plea = Plea;

  // Returns a plea or nothing. number is which robot this is, counting from
  // one, so it is the kill count plus one.
  PR.Plea.for = function (number, name, rng) {
    const random = rng || Math.random;
    if (!name) return null;                   // it has nothing to call them
    if (number < FIRST || number > LAST) return null;
    if (number > FIRST && random() >= CHANCE) return null;
    return new Plea(LINES[random() < 0.5 ? 0 : 1]);
  };

  PR.Plea.FIRST = FIRST;
  PR.Plea.LAST = LAST;
  PR.Plea.CHANCE = CHANCE;
})(window);
