/*
  Sound, synthesised on the spot.

  There are no audio files. The project has no build step and has to keep
  working when index.html is opened over file://, where fetching a .wav is
  blocked outright -- so every sound here is built out of noise and
  oscillators at the moment it is asked for. It also keeps the whole game one
  folder of text.

  Nothing calls into this file directly. Sounds are asked for through
  fx.sound(), because every place that would want one -- a pellet landing, a
  blade biting, a limb coming off -- already holds the fx layer and already
  asks it for spray and shake. Sound is the third thing in that list, not a
  new dependency threaded through the robot and the items.

  Adding a weapon means adding one entry to SOUNDS and one fx.sound() call at
  the site that fires it. Nothing else here needs to know it exists.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const MUTE_KEY = 'misanthropy.muted';
  // Left where it was when the compressor came out. Raising it to compensate
  // for the gentler curve was a mistake based on a bad guess at how much the
  // compressor had been doing: measured, it was doing a great deal, and the
  // blast came back 24% above the level it had been signed off at. The
  // loudest sound is the reference, so the reference does not move.
  const MASTER = 0.55;
  const SHAPER_HEADROOM = 3;  // how far past full scale the curve still bends
  const VOICE_CAP = 26;     // scheduled sounds allowed to overlap
  const NOISE_SECONDS = 2;

  // Shortest gap between two of the same sound. Buckshot is the reason this
  // exists: nine pellets resolve in the same tick, and nine identical pings
  // scheduled at the same instant do not sound like nine hits. They sound
  // like one loud click with a phasing artefact on it. Gating them down to a
  // handful, scattered over a few milliseconds, is what reads as a rattle.
  const GAP = {
    pellet: 0.017, thud: 0.05, bolt: 0.04, clank: 0.05,
    shot: 0.06, bite: 0.06, pull: 0.1, tear: 0.08
  };
  const DEFAULT_GAP = 0.03;

  // How far behind the moment a repeat may still be scheduled before it is
  // dropped instead. This is a queue, not a delay: the first of any sound
  // always plays now, and only the ones piling up behind it get pushed.
  //
  // The earlier version jittered every sound by up to 50ms to decorrelate a
  // volley, which meant a mean 25ms of latency on a trigger pull that had
  // nothing to decorrelate against. Perceptible, and self-inflicted.
  const SPREAD = 0.06;

  // Every sound is (audio, startTime, opts). Durations are in seconds and
  // are deliberately short: this is a pixel sandbox, not a film, and a tail
  // that outlasts the event on screen reads as a different event.
  const SOUNDS = {

    // The loudest thing in the game, and the only one allowed to be. Three
    // layers: the crack leaving the barrel, the body of the blast, and the
    // low thump that gives it mass.
    shot: function (a, t) {
      a.play(t, 0.34, a.noiseAt(t, 0.34), a.filter('lowpass', t, 4200, 260, 0.28, 0.9),
        a.env(t, 0.85, 0.004, 0.32));
      a.play(t, 0.05, a.noiseAt(t, 0.05), a.filter('highpass', t, 2600, 2600, 0.05),
        a.env(t, 0.5, 0.002, 0.045));
      a.play(t, 0.22, a.osc('sine', t, 120, 42, 0.16), a.env(t, 0.7, 0.006, 0.2));
    },

    // Buckshot on plating. Two detuned partials rather than one: a single
    // sine reads as a game beep, two inharmonic ones read as metal.
    pellet: function (a, t) {
      const f = 1500 + Math.random() * 2300;
      a.play(t, 0.09, a.osc('triangle', t, f, f * 0.82, 0.08), a.env(t, 0.11, 0.001, 0.075));
      a.play(t, 0.07, a.osc('triangle', t, f * 1.47, f * 1.2, 0.06), a.env(t, 0.07, 0.001, 0.06));
      a.play(t, 0.02, a.noiseAt(t, 0.02), a.filter('highpass', t, 3200, 3200, 0.02),
        a.env(t, 0.18, 0.001, 0.018));
    },

    // A blade going in. The axe is not a louder knife: it is lower, longer
    // and carries more body, which is the same difference the physics makes
    // between the two of them.
    bite: function (a, t, o) {
      const heavy = !!(o && o.heavy);
      const dur = heavy ? 0.2 : 0.13;
      a.play(t, dur, a.noiseAt(t, dur),
        a.filter('bandpass', t, heavy ? 1600 : 2600, heavy ? 380 : 700, dur, 3),
        a.env(t, heavy ? 0.7 : 0.5, 0.003, dur));
      a.play(t, dur + 0.04, a.osc('sine', t, heavy ? 150 : 260, heavy ? 60 : 120, dur),
        a.env(t, heavy ? 0.6 : 0.34, 0.004, dur + 0.03));
    },

    // Working a buried blade back out: a rising scrape, because it has to be
    // the opposite of the sound that put it there or the two blur into one
    // event.
    // A narrow band with a slow attack throws most of its energy away, so
    // this one is written far hotter than it measures: at the gain the
    // others use it came out at a tenth of a pellet and was inaudible under
    // anything else on screen.
    pull: function (a, t) {
      a.play(t, 0.28, a.noiseAt(t, 0.28, 0.7),
        a.filter('bandpass', t, 500, 1900, 0.26, 4), a.env(t, 1.1, 0.04, 0.26));
    },

    // A limb coming off. Second loudest, and the only sound with a groan in
    // it: the descending saw is the joint giving way, the clank on the end
    // is what is left of it swinging free.
    tear: function (a, t) {
      a.play(t, 0.4, a.noiseAt(t, 0.4), a.filter('lowpass', t, 2200, 220, 0.36, 1.2),
        a.env(t, 0.75, 0.005, 0.38));
      a.play(t, 0.36, a.osc('sawtooth', t, 420, 70, 0.34),
        a.filter('lowpass', t, 1400, 500, 0.34, 4), a.env(t, 0.3, 0.01, 0.33));
      a.play(t + 0.03, 0.14, a.osc('triangle', t + 0.03, 900, 700, 0.13),
        a.env(t + 0.03, 0.16, 0.002, 0.12));
    },

    // Bodywork meeting the floor or a wall. power comes from the solver, so
    // a tap and a slam are one sound at two weights rather than two sounds
    // with a threshold between them.
    //
    // Held well under the blast and under a limb coming off. Measured flat
    // it wanted to be nearly as loud as the shotgun, which is wrong twice
    // over: a thrown robot makes several of these a second, and the loudest
    // thing in a game about taking something apart should be the taking
    // apart, not the furniture.
    thud: function (a, t, o) {
      const p = Math.max(0.15, Math.min(1, ((o && o.power) || 1) / 2.4));
      a.play(t, 0.16, a.osc('sine', t, 90 + p * 40, 38, 0.13), a.env(t, 0.36 * p, 0.004, 0.14));
      a.play(t, 0.1, a.noiseAt(t, 0.1), a.filter('lowpass', t, 900, 300, 0.09),
        a.env(t, 0.26 * p, 0.002, 0.09));
      const f = 340 + Math.random() * 180;
      a.play(t, 0.18, a.osc('triangle', t, f, f * 0.9, 0.16), a.env(t, 0.1 * p, 0.003, 0.15));
    },

    // A dropped weapon landing. Two inharmonic partials and no low end: it
    // is hollow, and the robot is not.
    clank: function (a, t) {
      const f = 620 + Math.random() * 260;
      a.play(t, 0.2, a.osc('triangle', t, f, f * 0.94, 0.18), a.env(t, 0.16, 0.002, 0.17));
      a.play(t, 0.15, a.osc('triangle', t, f * 1.63, f * 1.5, 0.13), a.env(t, 0.1, 0.002, 0.12));
      a.play(t, 0.03, a.noiseAt(t, 0.03), a.filter('highpass', t, 2000, 2000, 0.03),
        a.env(t, 0.14, 0.001, 0.028));
    },

    // A bolt hitting the floor. Kept very quiet on purpose: bolts come off
    // in threes and they are punctuation, not an event.
    bolt: function (a, t) {
      const f = 2200 + Math.random() * 1400;
      a.play(t, 0.06, a.osc('triangle', t, f, f * 0.7, 0.05), a.env(t, 0.055, 0.001, 0.05));
    },

    // One line of the record arriving. A dry contact click, the sound of
    // something being entered rather than said -- the report is a list being
    // read out by a machine, and it should sound like the machine.
    // Written hot for the same reason as pull: the bandpass costs about
    // three quarters of it. It has to sit above the bed it lands on, or the
    // lines stop arriving separately, which is the only thing it is for.
    // The answer to a survey question, weighted the same way the flash of
    // colour is: 1 is the mild admission, 3 is the one with nothing left to
    // hide behind. Kept very short -- it lands under a wash of colour and its
    // job is to give that wash a body, not to be a sound in its own right.
    // The three are one gesture at three temperatures rather than three
    // different noises, so what the player hears is the weight and not a
    // change of subject.
    pulse: function (a, t, o) {
      const weight = Math.max(1, Math.min(3, (o && o.weight) || 1));
      if (weight === 1) {
        a.play(t, 0.2, a.osc('sine', t, 880, 700, 0.17), a.env(t, 0.32, 0.002, 0.16));
        a.play(t, 0.1, a.osc('sine', t, 1760, 1500, 0.08), a.env(t, 0.07, 0.002, 0.07));
      } else if (weight === 2) {
        // A pair a few cents apart, so it beats slightly inside its own length.
        a.play(t, 0.26, a.osc('triangle', t, 520, 430, 0.22), a.env(t, 0.34, 0.003, 0.21));
        a.play(t, 0.26, a.osc('triangle', t, 527, 436, 0.22), a.env(t, 0.22, 0.003, 0.21));
      } else {
        a.play(t, 0.32, a.osc('sawtooth', t, 190, 62, 0.28),
          a.filter('lowpass', t, 1000, 260, 0.28, 3), a.env(t, 0.55, 0.003, 0.29));
        a.play(t, 0.14, a.noiseAt(t, 0.14), a.filter('bandpass', t, 1500, 520, 0.13, 2),
          a.env(t, 0.4, 0.002, 0.12));
      }
    },

    // One character of the analysis being typed -- ten a second, since it
    // fires on every third one. Written at a third of the gain of the tick
    // that carries a whole line of the record and still measures level with
    // it, because a narrow bandpass hands most of it back. Tuned by measuring
    // it against that tick, not by reading the number below.
    type: function (a, t) {
      a.play(t, 0.02, a.noiseAt(t, 0.02), a.filter('bandpass', t, 2400, 2400, 0.02, 3),
        a.env(t, 0.035, 0.001, 0.017));
    },

    // The last word, for the one group that gets one. Longer and lower than
    // anything else on the overlay: it is not a response to a choice, it is
    // the door closing.
    sting: function (a, t) {
      a.play(t, 0.9, a.osc('sawtooth', t, 150, 40, 0.8),
        a.filter('lowpass', t, 800, 160, 0.8, 2.5), a.env(t, 0.42, 0.01, 0.85));
      a.play(t, 0.5, a.noiseAt(t, 0.5), a.filter('lowpass', t, 1600, 220, 0.45, 1.4),
        a.env(t, 0.22, 0.004, 0.48));
      a.play(t, 1.1, a.osc('sine', t, 74, 55, 0.9), a.env(t, 0.28, 0.02, 1.05));
    },

    tick: function (a, t) {
      a.play(t, 0.03, a.noiseAt(t, 0.03), a.filter('bandpass', t, 1800, 1800, 0.03, 2),
        a.env(t, 0.45, 0.001, 0.025));
      a.play(t, 0.04, a.osc('triangle', t, 1400, 1200, 0.035), a.env(t, 0.12, 0.001, 0.03));
    }
  };

  // Sounds that belong to the overlay rather than the scene, and so must not
  // be ducked away by the very screen they are playing under.
  const OVERLAY = { tick: true, pulse: true, type: true, sting: true };

  // The theme, written out as samples rather than scheduled as notes.
  //
  // A motif is a sequence, and a sequence needs something to keep feeding it
  // for as long as the screen is up. Scheduling every note in advance means
  // guessing how long that will be; a running scheduler means a timer to own
  // and cancel. Drawing one loop into a buffer and letting the graph repeat
  // it is neither: one node, exact, seamless, and it stops when it is told.
  //
  // Sparse on purpose. This plays under a form that tells the reader they
  // have been selected, and a tune would make that a joke. Six notes in
  // sixteen seconds, minor, falling, and the last one decays out well before
  // the seam so the loop cannot click.
  const THEME_LOOP = 16;
  const THEME_NOTES = [
    { at: 0.0,  hz: 220.00 },   // A3
    { at: 2.4,  hz: 261.63 },   // C4
    { at: 5.0,  hz: 329.63 },   // E4
    { at: 7.8,  hz: 293.66 },   // D4
    { at: 10.4, hz: 261.63 },   // C4
    { at: 12.8, hz: 164.81 }    // E3
  ];

  function themeBuffer(ctx) {
    const rate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.floor(rate * THEME_LOOP), rate);
    const out = buffer.getChannelData(0);
    for (const note of THEME_NOTES) {
      const start = Math.floor(note.at * rate);
      const length = Math.floor(2.8 * rate);
      for (let i = 0; i < length && start + i < out.length; i++) {
        const s = i / rate;
        // Soft attack so it arrives rather than starts, and an exponential
        // tail that is inaudible long before the note's slot runs out.
        const env = Math.min(1, s / 0.04) * Math.exp(-s * 2);
        // A second harmonic at a third: enough to stop it reading as a test
        // tone, not enough to make it an instrument.
        const wave = Math.sin(2 * Math.PI * note.hz * s) +
                     0.3 * Math.sin(4 * Math.PI * note.hz * s);
        out[start + i] += env * wave * 0.16;
      }
    }
    return buffer;
  }

  // Sustained beds, held for as long as a screen is up rather than fired and
  // forgotten. They are a different contract from the table above -- they
  // are started, they are stopped, and the player can cut them short by
  // clicking through -- so they live in their own table with their own
  // lifecycle rather than being one-shots with a very long tail.
  const DRONES = {

    // Under the milestone lines. Two sines a fraction apart: the beat
    // between them lands about every second and a half, slow enough to be
    // felt as unease rather than heard as a wobble. One steady tone is
    // ominous; two that will not quite agree is worse, and it costs one
    // oscillator.
    //
    // The sweep at the top is the entry -- it falls through the whole shake
    // and settles onto the drone as the picture finishes going, so the sound
    // and the black arrive together instead of the sound merely starting.
    dread: {
      attack: 1.2,      // swells across the 1.3s shake
      build: function (a, t, out) {
        const nodes = [];
        const bed = (hz, level, type) => {
          const o = a.ctx.createOscillator();
          o.type = type || 'sine';
          o.frequency.setValueAtTime(hz, t);
          const g = a.ctx.createGain();
          g.gain.value = level;
          o.connect(g); g.connect(out);
          o.start(t);
          nodes.push(o);
          return o;
        };
        // Held well under the one-shots even though it measures lower than
        // them: a tone that runs for six seconds is heard far louder than a
        // transient at the same peak, and this one has to sit under a line of
        // text the player is meant to read.
        bed(46, 0.20);
        bed(46.7, 0.17);
        // The octave carries the drone on hardware that cannot reproduce the
        // fundamental at all. A laptop speaker does nothing with 46Hz, and a
        // tension bed that exists only on headphones is not a tension bed.
        // Triangle rather than sine for the same reason -- its harmonics run
        // up into the range small speakers actually have.
        bed(92, 0.075, 'triangle');

        // Air. Barely there on purpose: loud enough that its absence is felt
        // when the interlude ends, too quiet to be identified while it runs.
        const air = a.ctx.createBufferSource();
        air.buffer = a.noise;
        air.loop = true;
        const airFilter = a.filter('bandpass', t, 3200, 3200, 0.1, 8);
        const airGain = a.ctx.createGain();
        airGain.gain.value = 0.028;
        air.connect(airFilter); airFilter.connect(airGain); airGain.connect(out);
        air.start(t);
        nodes.push(air);

        const fall = a.ctx.createOscillator();
        fall.type = 'sawtooth';
        fall.frequency.setValueAtTime(300, t);
        fall.frequency.exponentialRampToValueAtTime(55, t + 1.3);
        const fallFilter = a.filter('lowpass', t, 1200, 300, 1.3, 3);
        const fallGain = a.ctx.createGain();
        fallGain.gain.setValueAtTime(0.11, t);
        fallGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        fall.connect(fallFilter); fallFilter.connect(fallGain); fallGain.connect(out);
        fall.start(t); fall.stop(t + 1.7);
        nodes.push(fall);

        return nodes;
      }
    },

    // The way in. Same root as the interlude beds so the whole thing sounds
    // like one place, but with something moving over it -- this is the only
    // screen the player is invited into rather than interrupted by.
    theme: {
      attack: 2,        // slow enough that it is there before it is noticed
      build: function (a, t, out) {
        const nodes = [];
        if (!a.themeLoop) a.themeLoop = themeBuffer(a.ctx);
        const motif = a.ctx.createBufferSource();
        motif.buffer = a.themeLoop;
        motif.loop = true;
        const motifGain = a.ctx.createGain();
        motifGain.gain.value = 0.9;
        motif.connect(motifGain); motifGain.connect(out);
        motif.start(t);
        nodes.push(motif);

        const bed = (hz, level) => {
          const o = a.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(hz, t);
          const g = a.ctx.createGain();
          g.gain.value = level;
          o.connect(g); g.connect(out);
          o.start(t);
          nodes.push(o);
        };
        bed(55, 0.09);      // A1, the root the motif keeps returning to
        bed(110, 0.04);
        return nodes;
      }
    },

    // Under the last screen. The record's bed was flat on purpose because
    // that screen only listed things; this one passes judgement, so the same
    // room gets a weight put on it -- the hum drops an octave, a slow swell
    // moves underneath, and a thin high line sits on top. Still not a horror
    // sting: the words are doing the work and the sound is only agreeing to
    // stay in the room while they do.
    reckoning: {
      attack: 1.6,
      build: function (a, t, out) {
        const nodes = [];
        const bed = (hz, level, type) => {
          const o = a.ctx.createOscillator();
          o.type = type || 'sine';
          o.frequency.setValueAtTime(hz, t);
          const g = a.ctx.createGain();
          g.gain.value = level;
          o.connect(g); g.connect(out);
          o.start(t);
          nodes.push(o);
          return g;
        };
        bed(37, 0.125);
        bed(74, 0.08);
        bed(111, 0.024, 'triangle');

        // A swell rather than a beat: it arrives and leaves over eleven
        // seconds, which is slow enough that it is felt as the room breathing
        // in rather than heard as anything repeating.
        const swell = a.ctx.createGain();
        swell.gain.value = 0.6;
        swell.connect(out);
        const lfo = a.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.09, t);
        const depth = a.ctx.createGain();
        depth.gain.value = 0.4;
        lfo.connect(depth); depth.connect(swell.gain);
        lfo.start(t);
        nodes.push(lfo);

        const low = a.ctx.createOscillator();
        low.type = 'sine';
        low.frequency.setValueAtTime(55, t);
        const lowGain = a.ctx.createGain();
        lowGain.gain.value = 0.095;
        low.connect(lowGain); lowGain.connect(swell);
        low.start(t);
        nodes.push(low);

        const air = a.ctx.createBufferSource();
        air.buffer = a.noise;
        air.loop = true;
        const airFilter = a.filter('bandpass', t, 4200, 4200, 0.1, 12);
        const airGain = a.ctx.createGain();
        airGain.gain.value = 0.018;
        air.connect(airFilter); airFilter.connect(airGain); airGain.connect(out);
        air.start(t);
        nodes.push(air);

        return nodes;
      }
    },

    // Under the record. Deliberately not frightening: mains hum and its
    // third, the sound of a room with the lights on and nobody in it. The
    // congratulation is warm and the list underneath it is flat, and the
    // whole screen turns on that gap -- scoring it like a horror beat would
    // tell the player what to feel and close the gap up. No beating and no
    // air, only a very slow breath so it is not quite dead.
    clinic: {
      attack: 0.8,
      build: function (a, t, out) {
        const nodes = [];
        const breath = a.ctx.createGain();
        breath.gain.value = 0.78;
        breath.connect(out);

        const lfo = a.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.13, t);
        const lfoDepth = a.ctx.createGain();
        lfoDepth.gain.value = 0.22;
        lfo.connect(lfoDepth); lfoDepth.connect(breath.gain);
        lfo.start(t);
        nodes.push(lfo);

        const bed = (hz, level) => {
          const o = a.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(hz, t);
          const g = a.ctx.createGain();
          g.gain.value = level;
          o.connect(g); g.connect(breath);
          o.start(t);
          nodes.push(o);
        };
        bed(50, 0.10);
        bed(100, 0.16);
        bed(300, 0.035);

        return nodes;
      }
    }
  };

  PR.Audio = class {
    constructor() {
      this.ctx = null;
      this.bus = null;        // the scene: limited, and ducked by the overlay
      this.overlayBus = null; // the interlude: never ducked, see start()
      this.target = null;     // which of the two the sound being built goes to
      this.duckGain = null;
      this.masterGain = null;
      this.noise = null;
      this.voices = 0;
      this.next = {};         // sound name -> when the next repeat may start
      this.ducked = 0;
      try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { this.muted = false; }
    }

    // Built on the first gesture rather than at load. Browsers start a
    // context suspended until the page has been interacted with, so one made
    // at boot is a suspended context that has to be resumed anyway -- and on
    // a page nobody clicks, an audio graph that was never needed.
    start() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
        return this.ctx;
      }
      const Ctor = global.AudioContext || global.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor({ latencyHint: 'interactive' });

      // Something has to stop the peaks, because the shotgun is three layers
      // and a limb can come off inside the same tick; that combination sums
      // past full scale, and clipping on a page this quiet sounds like a
      // fault. It used to be a DynamicsCompressor, which does the job but
      // looks ahead to do it -- measured at 6.0ms, or 288 samples, of delay
      // on every sound in the scene. On a trigger pull that is worth more
      // than the tidiness it buys.
      //
      // A waveshaper does it with none. The curve is tanh across three times
      // full scale, so anything normal passes near enough untouched and only
      // the peaks bend over: at a third of full scale it costs 3%, at the
      // level a single blast reaches it costs 19%, and nothing can get out
      // above 1 no matter how much arrives.
      const shaper = this.ctx.createWaveShaper();
      const n = 2048, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * SHAPER_HEADROOM);
      shaper.curve = curve;
      // Every oversample setting other than 'none' resamples, and resampling
      // is latency -- which is the whole reason this is not a compressor.
      shaper.oversample = 'none';

      // The curve spans the input range -1..1, so the scene is scaled into it
      // and the shaping maths comes out as plain tanh of the real signal.
      const preGain = this.ctx.createGain();
      preGain.gain.value = 1 / SHAPER_HEADROOM;
      preGain.connect(shaper);

      this.duckGain = this.ctx.createGain();
      this.masterGain = this.ctx.createGain();
      this.duckGain.gain.value = 1;
      this.masterGain.gain.value = this.muted ? 0 : MASTER;

      // Two buses, because the black screen ducks one of them to silence and
      // the interlude has to be audible underneath exactly that. The scene
      // goes through the limiter and the duck; the overlay goes straight to
      // the master and is never ducked, so what the player hears while the
      // picture is gone is only ever the interlude.
      this.overlayBus = this.ctx.createGain();
      this.overlayBus.gain.value = 1;

      shaper.connect(this.duckGain);
      this.duckGain.connect(this.masterGain);
      this.overlayBus.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.bus = preGain;

      const frames = Math.floor(this.ctx.sampleRate * NOISE_SECONDS);
      this.noise = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      this.noiseSeconds = NOISE_SECONDS;
      return this.ctx;
    }

    setMuted(muted) {
      this.muted = !!muted;
      try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch (e) { /* private mode */ }
      if (this.masterGain) this.applyGain(0.05);
      return this.muted;
    }

    toggleMute() { return this.setMuted(!this.muted); }

    // The overlay's opacity, handed straight over: the black screen taking
    // the picture is the same gesture as it taking the sound, and running
    // both off one number means they can never drift apart.
    duck(level) {
      const clamped = Math.max(0, Math.min(1, level || 0));
      if (Math.abs(clamped - this.ducked) < 0.01) return;
      this.ducked = clamped;
      if (this.duckGain) this.applyGain(0.08);
    }

    applyGain(ramp) {
      const now = this.ctx.currentTime;
      const master = this.muted ? 0 : MASTER;
      const ride = (param, target) => {
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(target, now + ramp);
      };
      ride(this.masterGain.gain, master);
      ride(this.duckGain.gain, 1 - this.ducked);
    }

    // The one entry point. Silently does nothing until the context exists,
    // so a sound asked for before the first click is dropped rather than
    // queued: a burst of stale hits arriving on the first gesture would be
    // worse than the silence it replaced.
    fire(name, opts) {
      if (this.muted || !this.ctx || !this.bus) return false;
      const def = SOUNDS[name];
      if (!def) return false;
      if (this.voices >= VOICE_CAP) return false;
      // A cursor, not a jitter. The first of a sound goes out at once; a
      // repeat arriving while that one is still fresh queues up behind it,
      // and once the queue runs past SPREAD the rest are dropped rather than
      // played late. A volley still rattles, and a single shot is immediate.
      const now = this.ctx.currentTime;
      const gap = GAP[name] === undefined ? DEFAULT_GAP : GAP[name];
      const t = Math.max(now, this.next[name] || 0);
      if (t - now > SPREAD) return false;
      this.next[name] = t + gap + Math.random() * gap;
      // Read by play(), which is only ever reached from inside def().
      this.target = OVERLAY[name] ? this.overlayBus : this.bus;
      def(this, t, opts);
      this.target = null;
      return true;
    }

    // Starts a bed and hands back the only thing that can stop it. Unlike
    // fire(), this runs even while muted: a bed can outlast a keypress, and
    // muting during an interlude and unmuting again should leave the sound
    // where it would have been rather than a hole. The master gain is doing
    // the silencing either way.
    sustain(name) {
      if (!this.ctx || !this.overlayBus) return null;
      const def = DRONES[name];
      if (!def) return null;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + def.attack);
      g.connect(this.overlayBus);
      const nodes = def.build(this, t, g);
      return {
        stop(fade) {
          const now = ctx.currentTime;
          const f = fade === undefined ? 0.6 : fade;
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + f);
          // Stopping after the fade, not with it: a bed cut at the source
          // clicks, and a click is the one thing a held tone must not end on.
          for (const n of nodes) if (n.stop) n.stop(now + f + 0.1);
        }
      };
    }

    // --- scheduling helpers, used only by the table above ---

    // A slice of the shared noise buffer from a random offset, so two bursts
    // in a row are never the same sample of noise.
    noiseAt(t, dur, rate) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = rate || 1;
      src.start(t, Math.random() * (this.noiseSeconds - dur - 0.05), dur + 0.02);
      return src;
    }

    osc(type, t, from, to, dur) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
      return o;
    }

    filter(type, t, from, to, dur, q) {
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.Q.value = q === undefined ? 1 : q;
      f.frequency.setValueAtTime(from, t);
      if (to !== from) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      return f;
    }

    // Exponential ramps cannot reach zero, hence the floor rather than 0.
    // The attack is a ramp and not a step because a step on a raw oscillator
    // is itself a click, and every sound here already has a better one.
    env(t, peak, attack, dur) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      return g;
    }

    // Connects source -> filters -> envelope -> bus and books a voice for
    // the length of it.
    play(t, dur, source) {
      let node = source;
      for (let i = 3; i < arguments.length; i++) {
        const next = arguments[i];
        if (!next) continue;
        node.connect(next);
        node = next;
      }
      node.connect(this.target || this.bus);
      this.voices++;
      const done = () => { this.voices--; };
      if ('onended' in source) source.onended = done;
      else global.setTimeout(done, (dur + 0.1) * 1000);
    }
  };

  // Every registered sound, so the tests can walk the table rather than
  // repeat it. A weapon added here is checked for a legal graph without
  // anyone having to remember to add it to the suite as well.
  PR.Audio.names = Object.keys(SOUNDS);
  PR.Audio.beds = Object.keys(DRONES);
})(window);
