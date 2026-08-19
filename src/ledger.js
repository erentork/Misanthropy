/*
  The record.

  Counts, quietly, from the first frame. Nothing here is shown while playing
  and nothing here affects the simulation -- it exists so that the question
  at twenty kills can be answered with what the player actually did instead
  of with another rhetorical line.

  The numbers were chosen to be the ones that are uncomfortable to read:
  not how much damage was dealt, but how long the hesitation lasted, how
  much of it landed on something already curled up, and how much landed on
  something already dead.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  // Blows this close together are one strike, not nine: every pellet of a
  // shell lands at the same instant, so without this a shotgun would score
  // nine times what a knife does for the same act.
  const STRIKE_GAP = 0.35;

  PR.Ledger = class {
    constructor() {
      this.kills = 0;
      this.limbs = 0;
      this.shots = 0;
      this.blows = 0;
      this.defenceless = 0;   // blows on a robot that had already lost a limb
      this.afterDeath = 0;    // blows on one that was already dead
      this.desecrations = 0;  // deliberate returns to a corpse, volleys collapsed
      this.delays = [];       // seconds between a robot appearing and its first blow
      this.spawnedAt = 0;
      this.struck = false;
      this.diedAt = null;
      this.lastCorpseBlow = 0;
    }

    robotAppeared(now) {
      this.spawnedAt = now;
      this.struck = false;
      this.diedAt = null;
      this.lastCorpseBlow = 0;
    }

    shot() { this.shots++; }
    limbLost() { this.limbs++; }
    killed() { this.kills++; }

    // `state` is what the robot was before this blow landed.
    struckRobot(now, state) {
      this.blows++;
      if (state === 'wounded') this.defenceless++;
      if (state === 'dead') {
        this.afterDeath++;
        // The first blow to land on a corpse is the tail of the volley that
        // did the killing, so it starts the clock instead of counting. The
        // moment of death is taken from it rather than from the kill being
        // tallied, because the rest of that volley arrives before the frame
        // loop ever notices the robot died. A wider window than the volley
        // itself is wrong: at 0.6s it swallowed a whole second shell, and
        // someone emptying the tube into a corpse came out clean.
        if (this.diedAt === null) {
          this.diedAt = now;
          this.lastCorpseBlow = now;
        } else if (now - this.lastCorpseBlow > STRIKE_GAP) {
          this.desecrations++;
          this.lastCorpseBlow = now;
        }
      }
      if (!this.struck) {
        this.struck = true;
        this.delays.push(Math.max(0, now - this.spawnedAt));
      }
    }

    // Which of the four they get sorted into. Two axes, both measured
    // rather than guessed: how long they hesitated over the last few, and
    // how much of what they did landed on something that could not answer.
    // The letters are not a scale -- being told you are an A is the point,
    // and nobody is told what the letters mean until afterwards.
    group() {
      // Measured per kill, not per blow, and only from corpses. Striking a
      // wounded robot is how a kill is finished -- it is required, so it
      // cannot be evidence of anything. Going back to one that is already
      // dead is not required by anything.
      //
      // The first version counted every blow on a wounded or dead robot as a
      // share of all blows, and it classified a player who killed cleanly and
      // stopped as Merciless: the killing volley's own pellets landed on the
      // corpse, and finishing a kill means striking something wounded. It
      // also moved the answer when the armour level changed, which meant it
      // was measuring the weapon rather than the person.
      const returns = this.desecrations / Math.max(1, this.kills);
      const recent = this.delays.slice(-3);
      const wait = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      const quick = wait < 1.5;
      const cruel = returns > 1;
      return {
        letter: quick ? (cruel ? 'A' : 'B') : (cruel ? 'C' : 'D'),
        quick, cruel, wait, returns
      };
    }

    // Report lines, already translated. Anything that never happened is left
    // out rather than printed as a zero: a line saying "0" reads as an
    // accusation the player can dismiss.
    lines() {
      const t = (key, vars) => PR.i18n.t(key, vars);
      const out = [t('report.kills', { n: this.kills })];
      if (this.limbs) out.push(t('report.limbs', { n: this.limbs }));
      if (this.shots) out.push(t('report.shots', { n: this.shots }));
      if (this.delays.length >= 2) {
        out.push(t('report.hesitation', {
          first: this.delays[0].toFixed(1),
          last: this.delays[this.delays.length - 1].toFixed(1)
        }));
      }
      if (this.defenceless) out.push(t('report.defenceless', { n: this.defenceless }));
      // Reported as returns rather than as raw blows, for the same reason the
      // classification uses them: one shell is one act, not nine.
      if (this.desecrations) out.push(t('report.afterDeath', { n: this.desecrations }));
      out.push(t('report.end'));
      return out;
    }
  };
})(window);
