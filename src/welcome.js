/*
  The way in.

  A form, not a title screen. The page is already a white clinical thing with
  thin grey rules, and the voice that runs the experiment is administrative --
  it congratulates, it sorts, it files. So the first thing the player meets is
  an intake form telling them they have been selected as a candidate, with a
  field for their name and a button that starts the process. The join between
  that voice and what the player then does is the whole point of the game, and
  it is worth making before anything has happened rather than after twenty
  kills.

  DOM rather than raster, for the same reason the interlude is: at 480x270
  there is no room for a readable sentence.

  The name is only kept here. Nothing reads it yet.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const NAME_KEY = 'misanthropy.candidate';
  const NAME_MAX = 40;
  const LEAVE = 0.5;   // seconds of fade on the way out, matching the CSS

  // Who is at the keyboard, as they gave it. Kept across reloads because
  // being asked your name twice by the same system reads as the system having
  // forgotten you, which is the opposite of what this screen is doing.
  PR.candidate = {
    name: '',

    // Markup characters come out. Nothing renders the name as HTML today --
    // it is drawn as pixels by the font -- but it is the only text a player
    // can put into this game, it is kept across reloads, and i18n does use
    // innerHTML for the strings that carry <b>. Those two facts are one
    // careless refactor away from meeting, and stripping four characters at
    // the door costs nothing and closes it for good.
    clean(value) {
      return String(value === undefined || value === null ? '' : value)
        .replace(/[<>&"]/g, '')
        .trim()
        .slice(0, NAME_MAX);
    },

    set(value) {
      this.name = this.clean(value);
      try {
        if (this.name) localStorage.setItem(NAME_KEY, this.name);
        else localStorage.removeItem(NAME_KEY);
      } catch (e) { /* private mode */ }
      return this.name;
    },

    // Cleaned on the way back in as well: what is in storage was put there by
    // an older build, or by hand.
    load() {
      try { this.name = this.clean(localStorage.getItem(NAME_KEY)); } catch (e) { this.name = ''; }
      return this.name;
    }
  };

  PR.Welcome = class {
    constructor(root, input, button) {
      this.root = root;
      this.input = input;
      this.button = button;
      this.done = false;
      this.audio = null;    // set by main.js
      this.bed = null;
      this.onBegin = null;

      this.input.value = PR.candidate.load();
      this.refresh();
      if (global.document && document.body && document.body.classList) {
        document.body.classList.add('welcoming');
      }

      this.input.addEventListener('input', () => this.refresh());
      // Enter is how a form is submitted, and this is a form.
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.ready()) this.begin();
      });
      this.button.addEventListener('click', () => { if (this.ready()) this.begin(); });

      // A browser will not open an audio context until the page has been
      // touched, so the theme cannot play at load however much it would like
      // to. It comes in on the first thing the player does here, which in
      // practice is clicking into the name field.
      const wake = () => this.wake();
      this.root.addEventListener('pointerdown', wake);
      this.root.addEventListener('keydown', wake);
    }

    // The simulation does not run behind this, and neither do the shortcuts:
    // typing a name that contains "g" should not toggle gravity.
    blocking() { return !this.done; }

    ready() { return this.input.value.trim().length > 0; }

    refresh() { this.button.disabled = !this.ready(); }

    wake() {
      if (this.bed || this.done || !this.audio) return;
      this.audio.start();
      this.bed = this.audio.sustain('theme');
    }

    begin() {
      if (this.done) return;
      this.done = true;
      PR.candidate.set(this.input.value);
      if (this.audio) this.audio.start();
      // The theme goes with the screen rather than after it, so the room the
      // player lands in is silent until they do something in it.
      if (this.bed) { this.bed.stop(LEAVE); this.bed = null; }
      this.root.classList.add('going');
      if (global.document && document.body && document.body.classList) {
        document.body.classList.remove('welcoming');
      }
      global.setTimeout(() => { this.root.hidden = true; }, LEAVE * 1000);
      if (this.onBegin) this.onBegin(PR.candidate.name);
    }
  };
})(window);
