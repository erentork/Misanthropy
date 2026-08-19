/*
  The observer interlude.

  Every fifth robot killed, the screen shakes itself apart, goes black, and
  says one line. At twenty it stops talking and asks instead: do you want to
  see what you have done? Answering no ends it for good -- the game carries
  on without ever putting words on screen again, which is the one promise
  worth keeping properly. Answering yes, and confirming, shows the record.

  Nothing here resets or punishes. The point is the pause.

  The overlay is DOM rather than something drawn into the raster: at 480x270
  there is no room for a readable sentence, and this is the one moment the
  game speaks to the player rather than to the scene.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const SHAKE = 1.3;    // seconds of shaking while the picture darkens
  const HOLD = 4.5;     // seconds of black for a plain line
  const FADE = 1.0;     // seconds back to the scene
  const TEXT_AT = 0.55; // how dark it has to be before the words appear
  const LINE_GAP = 1.5; // seconds between report lines
  const LABEL_AFTER = 1.4;  // pause before the group comes back under the data
  const BACK_AFTER = 5;     // seconds before the questionnaire opens
  const ANSWER_GAP = 0.75;  // seconds the colour holds the screen after a choice
  const GROUP_IN = 1.9;     // the verdict's name fades in and is left alone
  const TYPE_SPEED = 0.034; // seconds per character of the analysis
  const AFTER_TYPE = 1.3;   // pause once it has finished typing
  const SPLIT_TIME = 1.5;   // the slide right and the record fading in beside it
  const LAST_WORD = 3.2;    // how long the red line holds before the scene returns
  const EARN_HOLD = 3.4;    // how long 'then earn it' is left alone before the report
  const REGRET_WAIT = 2.5;  // silence between the last scored question and this one
  const REGRET_BOXES = 2.0; // how long the question has the screen to itself after that

  // Kill counts that have something of their own to say. Past the last one
  // the interlude keeps coming every five kills and repeats that line --
  // there is nothing further to add, which is arguably the point.
  const MILESTONES = [5, 10, 15];
  const OFFER_AT = 20;  // from here on it offers the record instead

  const SILENCE_KEY = 'misanthropy.silenced';

  PR.Observer = class {
    constructor(root, line, choices, report, logo) {
      this.root = root;
      this.line = line;
      this.choices = choices;
      this.report = report;
      this.logo = logo;
      this.phase = null;
      this.time = 0;
      this.every = 5;
      this.shown = 0;
      this.pending = null;
      this.onSilence = null;
      this.onWake = null;
      this.onLeave = null;   // set by main.js: taking the page away for good
      this.audio = null;   // set by main.js; the black screen takes the sound too
      this.pulse = null;   // set by main.js: the wash of colour behind an answer
      this.survey = null;
      this.answering = false;
      this.boxesOut = false;
      this.asked = false;
      // The last screen's own nodes, set by main.js the way the pulse is.
      this.finalStage = null;
      this.finalGroup = null;
      this.finalAnalysis = null;
      this.finalRecordTitle = null;
      this.finalRecordLines = null;
      this.finalLast = null;
      this.bed = null;
      this.bedName = null;
      try { this.silenced = localStorage.getItem(SILENCE_KEY) === '1'; } catch (e) { this.silenced = false; }
    }

    // The simulation is frozen while the overlay is up, except during the
    // shake -- that is the scene coming apart, and freezing it would read as
    // a stutter. Clicks are swallowed too, or the player would be grabbing
    // limbs they cannot see.
    blocking() { return this.phase !== null && this.phase !== 'shake'; }
    active() { return this.phase !== null; }
    // Any phase that is waiting on a button rather than on the clock.
    asking() {
      return this.phase === 'ask' || this.phase === 'confirm' || this.phase === 'verdict' ||
             this.phase === 'report' || this.phase === 'survey' || this.phase === 'final' ||
             this.phase === 'regret' || this.phase === 'late';
    }

    unsilence() {
      this.silenced = false;
      try { localStorage.removeItem(SILENCE_KEY); } catch (e) { /* private mode */ }
      if (this.onWake) this.onWake();
    }

    silence() {
      this.silenced = true;
      try { localStorage.setItem(SILENCE_KEY, '1'); } catch (e) { /* private mode */ }
      if (this.onSilence) this.onSilence();
    }

    lineKey(kills) {
      let milestone = MILESTONES[0];
      for (const n of MILESTONES) if (kills >= n) milestone = n;
      return 'observer.line.' + milestone;
    }

    trigger(kills, ledger) {
      if (this.phase || this.silenced) return;
      this.pending = { kills, ledger };
      this.phase = 'shake';
      this.time = 0;
      this.useBed('dread');
      this.clearChoices();
      this.report.textContent = '';
      this.logo.hidden = true;
      this.line.textContent = kills >= OFFER_AT
        ? PR.i18n.t('ask.see')
        : PR.i18n.t(this.lineKey(kills));
      this.root.hidden = false;
      this.paint(0);
    }

    // Clicking through the black skips the wait, but never a question and
    // never the shake -- a stray shot would otherwise swallow the whole beat.
    skip() {
      if (this.phase === 'hold') { this.phase = 'fade'; this.time = 0; }
    }

    // The interlude has a sound of its own, held for as long as a screen is
    // up. It rides a bus the black screen does not duck -- the duck exists to
    // take the scene away, and this is what is left when it has.
    //
    // Two beds and one swap between them, and the swap is the whole point.
    // Dread while it is asking; something flat and administrative from the
    // moment it starts congratulating. The record is not scored as a threat
    // because it is not one: the discomfort is the distance between a warm
    // voice and a cold list, and a horror sting would tell the player what to
    // feel and close that distance up.
    useBed(name, fade) {
      if (this.bedName === name) return;
      this.bedName = name;
      if (this.bed) { this.bed.stop(fade); this.bed = null; }
      if (name && this.audio) this.bed = this.audio.sustain(name);
    }

    clearChoices() {
      this.choices.textContent = '';
      this.choices.hidden = true;
      this.choices.classList.remove('survey');
      this.root.classList.remove('interactive');
    }

    // A single button, for the steps that are not a yes or no.
    button(key, action) {
      const b = document.createElement('button');
      b.textContent = PR.i18n.t(key);
      b.addEventListener('click', (e) => { e.stopPropagation(); action(); });
      this.choices.appendChild(b);
      this.choices.hidden = false;
      this.root.classList.add('interactive');
      return b;
    }

    offer(question, onYes, onNo) {
      this.line.textContent = question;
      this.choices.textContent = '';
      this.choices.hidden = false;
      this.root.classList.add('interactive');
      const button = (key, action) => {
        const b = document.createElement('button');
        b.textContent = PR.i18n.t(key);
        b.addEventListener('click', (e) => { e.stopPropagation(); action(); });
        this.choices.appendChild(b);
      };
      button('ask.yes', onYes);
      button('ask.no', onNo);
    }

    askToSee() {
      this.phase = 'ask';
      this.time = 0;
      this.offer(PR.i18n.t('ask.see'),
        () => this.askIfSure(),
        () => { this.clearChoices(); this.silence(); this.phase = 'fade'; this.time = 0; });
    }

    askIfSure() {
      this.phase = 'confirm';
      this.time = 0;
      this.offer(PR.i18n.t('ask.sure'),
        () => this.showVerdict(),
        // Backing out at the second question is not the same as refusing:
        // the offer stays open and comes round again.
        () => { this.clearChoices(); this.phase = 'fade'; this.time = 0; });
    }

    // The congratulation lands before any of the data does. It is meant
    // warmly: the discomfort comes from the gap between this voice and the
    // flat list underneath it, not from the game being clever at the player.
    showVerdict() {
      this.clearChoices();
      this.phase = 'verdict';
      this.time = 0;
      this.useBed('clinic');
      this.group = this.pending.ledger.group();
      // The groups are named, not lettered, and the names accuse. Being
      // congratulated on being sorted into 'Merciless' is the join the whole
      // screen turns on. One of the four is left clean on purpose: if every
      // outcome were an accusation the classification would read as rigged,
      // and a player who feels stitched up stops feeling anything else.
      this.groupName = PR.i18n.t('verdict.name.' + this.group.letter);
      this.line.textContent = PR.i18n.t('verdict.congrats', { group: this.groupName });
      // The emblem arrives with the congratulation and stays for the rest of
      // the screen, so the last thing on it is the mark as well as the name.
      PR.drawLogo(this.logo, this.group.letter, 5);
      this.logo.hidden = false;
      this.report.textContent = '';
      this.button('verdict.reveal', () => this.showReport());
    }

    showReport() {
      this.clearChoices();
      this.phase = 'report';
      this.time = 0;
      this.shown = 0;
      this.line.textContent = PR.i18n.t('report.title');
      this.reportLines = this.pending.ledger.lines();
      this.report.textContent = '';
      this.labelled = false;
      this.wayOut = false;
    }

    // --- the questionnaire ---

    startSurvey() {
      this.phase = 'survey';
      this.time = 0;
      this.survey = new PR.Survey();
      this.report.textContent = '';
      this.logo.hidden = true;
      this.askQuestion();
    }

    askQuestion() {
      const page = this.survey.current();
      if (!page) return this.askRegret();
      this.clearChoices();
      this.line.textContent = PR.i18n.t(page.key);
      this.choices.classList.add('survey');
      this.choices.hidden = false;
      this.root.classList.add('interactive');
      // Built in the shuffled order, so the weight of an answer is never its
      // position on screen.
      for (const weight of page.order) {
        const b = document.createElement('button');
        b.textContent = PR.i18n.t(page.key + '.a' + weight);
        b.addEventListener('click', (e) => { e.stopPropagation(); this.choose(weight); });
        this.choices.appendChild(b);
      }
    }

    // The flash and the sound carry the same number, so what the player sees
    // and what they hear agree about what they just admitted to. The pause
    // afterwards exists so the colour is the thing on screen for a moment
    // rather than a frame between two questions.
    choose(weight) {
      if (this.phase !== 'survey' || this.answering) return;
      this.answering = true;
      this.survey.answer(weight);
      this.flash(weight);
      if (this.audio) this.audio.fire('pulse', { weight: weight });
      this.clearChoices();
      global.setTimeout(() => {
        this.answering = false;
        if (this.phase === 'survey') this.askQuestion();
      }, ANSWER_GAP * 1000);
    }

    flash(weight) {
      if (!this.pulse) return;
      const tone = weight >= 3 ? 'harsh' : (weight === 2 ? 'mid' : 'mild');
      this.pulse.hidden = false;
      this.pulse.className = '';
      // Reading offsetWidth restarts the animation; without it a second answer
      // of the same weight re-adds a class the element already has and
      // nothing plays.
      void this.pulse.offsetWidth;
      this.pulse.className = tone + ' on';
    }

    // --- one last question, before any of it is read back ---

    // Not a scored question. The three before it weighed what the player was
    // willing to admit; this one only asks whether they want anything done
    // about it, and it is the only place in the game where an answer decides
    // whether the rest of it happens at all. Say you want forgiving and the
    // record is read out to you. Say there was nothing to forgive and the
    // session is over -- no verdict, no analysis, nothing. Refusing to be
    // judged is granted, exactly, and it costs everything that came after.
    askRegret() {
      this.phase = 'regret';
      this.time = 0;
      this.clearChoices();
      this.report.textContent = '';
      this.logo.hidden = true;
      // The tension bed comes back for it: the flat administrative hum was
      // right for a list of numbers and wrong for this.
      this.useBed('dread');
      // Nothing on screen yet. The question needs a gap after the last of the
      // scored ones -- arriving straight off the back of them made it read as
      // a fourth question rather than a different kind of one.
      this.line.textContent = '';
      this.asked = false;
      // The boxes are not made yet. A box faded down to nothing is still a
      // box and can still be clicked, so the wait is done by not having built
      // it rather than by hiding it -- and it gives the question the screen to
      // itself for a moment, which is the whole point of slowing this down.
      this.boxesOut = false;
    }

    // The question itself, once the silence in front of it has run.
    sayRegret() {
      this.asked = true;
      this.line.textContent = PR.i18n.t('regret.ask');
      this.root.classList.add('slow-in');
    }

    offerRegret() {
      this.boxesOut = true;
      this.choices.classList.add('survey');
      this.choices.hidden = false;
      this.root.classList.add('interactive');
      const box = (key, action) => {
        const b = document.createElement('button');
        b.textContent = PR.i18n.t(key);
        b.addEventListener('click', (e) => { e.stopPropagation(); action(); });
        this.choices.appendChild(b);
      };
      box('regret.yes', () => this.showEarn());
      box('regret.no', () => this.showLate());
    }

    // Wanting to be forgiven is not the same as being forgiven, and the game
    // says so before it says anything else.
    showEarn() {
      this.phase = 'earn';
      this.time = 0;
      this.calmRegret();
      this.singleLine('regret.earn', 'mild');
    }

    showLate() {
      this.phase = 'late';
      this.time = 0;
      this.calmRegret();
      this.singleLine('regret.late', '');
      this.flash(3);
      if (this.audio) this.audio.fire('sting');
      this.button('regret.leave', () => this.leave());
    }

    calmRegret() {
      this.clearChoices();
      this.root.classList.remove('slow-in');
      this.line.textContent = '';
    }

    singleLine(key, tone) {
      this.finalLast.textContent = PR.i18n.t(key);
      this.finalLast.hidden = false;
      this.finalLast.className = tone;
      global.setTimeout(() => this.finalLast.classList.add('in'), 20);
    }

    // A tab cannot close itself unless a script opened it, so this asks and
    // then does the only other honest thing: takes the page away and leaves
    // nothing to come back to. main.js owns the actual removal, because what
    // is on the page is not this file's business.
    leave() {
      this.clearChoices();
      this.useBed(null, 0.4);
      try { global.close(); } catch (e) { /* a tab is not allowed to */ }
      if (this.onLeave) this.onLeave();
    }

    // --- the last screen ---

    // The whole thing runs off this.time rather than a chain of timers, for
    // the same reason the record does: it can then be stepped by hand in a
    // test, which is the only way any of this timing gets checked at all.
    endSurvey() {
      this.clearChoices();
      this.line.textContent = '';
      this.report.textContent = '';
      this.logo.hidden = true;
      this.phase = 'final';
      this.time = 0;
      this.useBed('reckoning');

      this.verdictKey = PR.Survey.verdictFor(this.survey.total());
      this.analysis = PR.i18n.t(this.verdictKey + '.text');
      this.typed = -1;
      this.split = false;
      this.wayHome = false;

      this.finalGroup.textContent = PR.i18n.t(this.verdictKey + '.name');
      this.finalGroup.className = '';
      this.finalAnalysis.textContent = '';
      this.finalAnalysis.className = '';
      this.finalRecordTitle.textContent = PR.i18n.t('report.title');
      this.finalRecordLines.textContent = '';
      if (this.finalLast) { this.finalLast.hidden = true; this.finalLast.className = ''; }
      this.finalStage.classList.remove('split');
      this.finalStage.hidden = false;
      // Off the same frame it is revealed the transition has nothing to run
      // from, so the fade is armed on the next one.
      global.setTimeout(() => this.finalGroup.classList.add('in'), 20);
    }

    updateFinal() {
      const t = this.time;
      if (t < GROUP_IN) return;

      // One character at a time off the clock, so the speed is the same on
      // any frame rate.
      const want = Math.min(this.analysis.length, Math.floor((t - GROUP_IN) / TYPE_SPEED));
      if (want > this.typed) {
        this.typed = want;
        this.finalAnalysis.textContent = this.analysis.slice(0, want);
        // Every third character. One per letter at this speed is a drill.
        if (want > 0 && want % 3 === 0 && this.audio) this.audio.fire('type');
        if (want >= this.analysis.length) this.finalAnalysis.className = 'done';
      }

      const typedAt = GROUP_IN + this.analysis.length * TYPE_SPEED;
      if (!this.split && t >= typedAt + AFTER_TYPE) {
        this.split = true;
        for (const text of this.pending.ledger.lines()) {
          const p = document.createElement('p');
          p.textContent = text;
          this.finalRecordLines.appendChild(p);
        }
        this.finalStage.classList.add('split');
      }

      if (!this.wayHome && t >= typedAt + AFTER_TYPE + SPLIT_TIME) {
        this.wayHome = true;
        // Functionally the way out for all three, worded so that only one of
        // them is being let off.
        this.button(this.verdictKey + '.back', () => {
          if (this.verdictKey === 'final.pathetic') this.lastWord();
          else this.finishReport();
        });
      }
    }

    // Only one group is told anything after it has chosen to leave, and it is
    // told it on its own, in red, with the door closing behind it.
    lastWord() {
      this.phase = 'last';
      this.time = 0;
      this.clearChoices();
      this.finalStage.hidden = true;
      this.finalLast.textContent = PR.i18n.t('final.pathetic.last');
      this.finalLast.hidden = false;
      this.finalLast.className = '';
      global.setTimeout(() => this.finalLast.classList.add('in'), 20);
      this.flash(3);
      if (this.audio) this.audio.fire('sting');
    }

    finishReport() {
      // Once it has been shown there is nothing left to say.
      this.clearChoices();
      this.silence();
      this.phase = 'fade';
      this.time = 0;
    }

    // One number drives the whole interlude. The picture going and the sound
    // going are the same gesture, so they are literally the same value: at
    // full black the scene is inaudible, and the shake fades out under it
    // rather than being cut off, which would read as the tab losing focus.
    paint(alpha) {
      if (this.audio) this.audio.duck(alpha);
      this.root.style.opacity = alpha;
      const text = Math.max(0, (alpha - TEXT_AT) / (1 - TEXT_AT));
      this.line.style.opacity = text;
      this.report.style.opacity = text;
      this.choices.style.opacity = text;
      this.logo.style.opacity = text;
    }

    update(dt, fx) {
      if (!this.phase) return;
      this.time += dt;

      if (this.phase === 'shake') {
        fx.shake(9);
        this.paint(Math.min(1, this.time / SHAKE));
        if (this.time >= SHAKE) {
          this.paint(1);
          this.time = 0;
          if (this.pending.kills >= OFFER_AT) this.askToSee();
          else this.phase = 'hold';
        }
      } else if (this.phase === 'hold') {
        if (this.time >= HOLD) { this.phase = 'fade'; this.time = 0; }
      } else if (this.phase === 'report') {
        // One line at a time, so the numbers land separately.
        if (this.shown < this.reportLines.length && this.time >= this.shown * LINE_GAP) {
          const p = document.createElement('p');
          p.textContent = this.reportLines[this.shown];
          this.report.appendChild(p);
          this.shown++;
          if (this.audio) this.audio.fire('tick');
        }
        const done = this.reportLines.length * LINE_GAP;
        // The label comes back last, so the thing still on screen at the end
        // is not the data but what they were sorted into because of it.
        if (!this.labelled && this.time >= done + LABEL_AFTER) {
          this.labelled = true;
          const label = document.createElement('p');
          label.className = 'verdict-label';
          label.textContent = PR.i18n.t('verdict.label', { group: this.groupName });
          const what = document.createElement('p');
          what.className = 'verdict-what';
          what.textContent = PR.i18n.t('verdict.group.' + this.group.letter);
          this.report.appendChild(label);
          this.report.appendChild(what);
        }
        // What used to be the way out is now the way further in. The record
        // has finished telling the player what they did; the questionnaire
        // asks them to account for it, and there is no answer on offer that
        // costs nothing.
        if (!this.wayOut && this.time >= done + LABEL_AFTER + BACK_AFTER) {
          this.wayOut = true;
          this.startSurvey();
        }
      } else if (this.phase === 'regret') {
        if (!this.asked && this.time >= REGRET_WAIT) this.sayRegret();
        else if (this.asked && !this.boxesOut && this.time >= REGRET_WAIT + REGRET_BOXES) this.offerRegret();
      } else if (this.phase === 'earn') {
        if (this.time >= EARN_HOLD) { this.finalLast.hidden = true; this.finalLast.className = ''; this.endSurvey(); }
      } else if (this.phase === 'final') {
        this.updateFinal();
      } else if (this.phase === 'last') {
        if (this.time >= LAST_WORD) this.finishReport();
      } else if (this.phase === 'fade') {
        // Every way out of the interlude ends up here -- clicking through,
        // refusing, backing out, or the hold simply running out -- so this is
        // the one place the bed needs stopping. It fades with the picture.
        this.useBed(null, FADE);
        this.paint(Math.max(0, 1 - this.time / FADE));
        if (this.time >= FADE) {
          this.phase = null;
          this.pending = null;
          this.root.hidden = true;
          this.clearChoices();
          this.logo.hidden = true;
          this.report.textContent = '';
          if (this.finalStage) { this.finalStage.hidden = true; this.finalStage.classList.remove('split'); }
          if (this.finalLast) { this.finalLast.hidden = true; this.finalLast.className = ''; }
          this.root.classList.remove('slow-in');
        }
      }
      // 'ask' and 'confirm' just wait for a button.
    }
  };
})(window);
