/*
  The notice that arrives with the first robot.

  It is the third thing the administration says, and it is written in the same
  voice as the other two: the intake form told the player they had been
  selected, this tells them what is in the room and that they may do as they
  like with it, and the interlude will later ask them how they feel about
  having done it. "Contribute to our development" is doing a lot of work in
  that sentence, which is the point -- permission granted in advance, by a
  system that is already counting.

  Unlike the way in, this does not block anything. It is a notice, not a gate:
  the scene runs behind it, the robot is standing there while it is read, and
  it can be dismissed the moment it appears. Blocking would make it a step to
  get through, and a step to get through gets clicked away unread.

  It sits above the robot rather than over it, so the thing being described is
  visible while the description is on screen.

  Shown once, when the way in is dismissed -- which is the moment the first
  robot becomes visible.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const LEAVE = 0.35;   // seconds of fade on the way out, matching the CSS

  PR.Notice = class {
    constructor(root, close) {
      this.root = root;
      this.close = close;
      this.shown = false;
      this.gone = false;

      this.close.addEventListener('click', () => this.dismiss());
      // The button's label is a symbol, so its accessible name is the only
      // translated thing on it and data-i18n cannot carry it.
      const name = () => {
        const text = PR.i18n.t('notice.close');
        this.close.setAttribute('aria-label', text);
        this.close.setAttribute('title', text);
      };
      name();
      PR.i18n.onChange(name);
    }

    show() {
      if (this.shown || this.gone) return;
      this.shown = true;
      this.root.hidden = false;
      // Off the same frame it is revealed the transition has nothing to run
      // from, so the class lands on the next one.
      global.setTimeout(() => this.root.classList.add('on'), 20);
    }

    dismiss() {
      if (this.gone) return;
      this.gone = true;
      this.root.classList.remove('on');
      global.setTimeout(() => { this.root.hidden = true; }, LEAVE * 1000);
    }

    visible() { return this.shown && !this.gone; }
  };
})(window);
