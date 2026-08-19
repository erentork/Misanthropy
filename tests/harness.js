/*
  Headless test harness.

  There is no build step and no test framework: the sources are plain scripts
  that attach to a global, so a test loads them with eval under a stub DOM and
  drives them directly. Every claim made about this project during development
  was measured this way, because the browser could not be automated from the
  agent's environment.

  Usage:
    const { load, stubDom } = require('./harness');
    const PR = load(['physics.js', 'robot.js']);
*/
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// Enough DOM for the modules that touch it. Canvas contexts hand back the
// few calls raster.js and logos.js actually make.
function stubDom() {
  const store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; }
  };
  // node exposes navigator as a getter-only global, so it has to be defined
  // rather than assigned.
  Object.defineProperty(global, 'navigator', { value: { language: 'tr-TR' }, configurable: true });
  global.document = {
    documentElement: {},
    createElement: () => node(),
    getElementById: () => node(),
    querySelectorAll: () => []
  };
  return store;
}

function node(tag) {
  const n = {
    tag: tag || 'div', children: [], style: {}, hidden: true, _text: '', className: '',
    width: 0, height: 0, painted: 0, dataset: {},
    classList: {
      list: new Set(),
      add(c) { this.list.add(c); }, remove(c) { this.list.delete(c); },
      toggle() {}, has(c) { return this.list.has(c); }
    },
    listeners: {},
    set textContent(v) { this._text = v; if (v === '') this.children = []; },
    get textContent() { return this._text; },
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html || ''; },
    appendChild(c) { this.children.push(c); return c; },
    contains() { return false; },
    attributes: {},
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    click() { for (const fn of this.listeners.click || []) fn({ stopPropagation() {} }); },
    getContext() {
      return {
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {}, drawImage() {}, clearRect() {},
        fillRect: () => { n.painted++; },
        set fillStyle(v) {}, get fillStyle() { return ''; },
        set imageSmoothingEnabled(v) {}, get imageSmoothingEnabled() { return false; }
      };
    }
  };
  return n;
}

// Enough Web Audio to schedule into and then measure. It records every node
// made and every value booked on a parameter, which is the only way to check
// a synthesiser from a terminal: the invariants that matter here are not what
// it sounds like but whether the graph it builds is legal. An exponential
// ramp to zero, or from zero, is a RangeError in a real browser and silence
// in a careless stub, so those are worth catching before a player does.
function stubAudio() {
  const log = { nodes: [], params: [], edges: [], connections: 0, ctx: null };

  // Every node reachable downstream of a starting node, for asking whether a
  // signal has to pass through something on its way out.
  log.downstream = (from) => {
    const seen = new Set(), queue = [from];
    while (queue.length) {
      const here = queue.pop();
      for (const [a, b] of log.edges) {
        if (a !== here || seen.has(b)) continue;
        seen.add(b);
        queue.push(b);
      }
    }
    return seen;
  };

  function param(name, value) {
    return {
      value: value === undefined ? 0 : value,
      setValueAtTime(v, t) { log.params.push({ name, kind: 'set', v, t }); this.value = v; return this; },
      linearRampToValueAtTime(v, t) { log.params.push({ name, kind: 'linear', v, t }); this.value = v; return this; },
      exponentialRampToValueAtTime(v, t) { log.params.push({ name, kind: 'exp', v, t }); this.value = v; return this; },
      cancelScheduledValues(t) { log.params.push({ name, kind: 'cancel', v: 0, t }); return this; }
    };
  }

  // Edges are recorded, not just counted, because one of the things worth
  // asserting about this graph is its shape: the interlude bed has to reach
  // the output without passing through the gain the black screen ducks, and
  // that is a question about who is connected to whom.
  function node(kind, extra) {
    const n = Object.assign({ kind, onended: null, disconnect() {}, start() {}, stop() {} }, extra || {});
    n.connect = (target) => { log.connections++; log.edges.push([n, target]); };
    log.nodes.push(n);
    return n;
  }

  class StubContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.state = 'running';
      this.destination = node('destination');
      log.ctx = this;
    }
    resume() { this.state = 'running'; }
    createGain() { return node('gain', { gain: param('gain', 1) }); }
    createOscillator() { return node('osc', { type: 'sine', frequency: param('frequency', 440), detune: param('detune') }); }
    createBufferSource() { return node('buffer', { buffer: null, playbackRate: param('playbackRate', 1) }); }
    createBiquadFilter() {
      return node('filter', { type: 'lowpass', frequency: param('frequency', 350), Q: param('Q', 1), gain: param('gain') });
    }
    createDynamicsCompressor() {
      return node('compressor', {
        threshold: param('threshold', -24), knee: param('knee', 30), ratio: param('ratio', 12),
        attack: param('attack', 0.003), release: param('release', 0.25)
      });
    }
    createWaveShaper() { return node('shaper', { curve: null, oversample: 'none' }); }
    createBuffer(channels, frames, rate) {
      const data = new Float32Array(frames);
      return { numberOfChannels: channels, length: frames, sampleRate: rate, duration: frames / rate, getChannelData: () => data };
    }
  }

  global.AudioContext = StubContext;
  return log;
}

function load(files) {
  global.window = global;
  if (!global.document) stubDom();
  for (const f of files) {
    // eslint-disable-next-line no-eval
    (0, eval)(fs.readFileSync(path.join(SRC, f), 'utf8'));
  }
  return global.PR;
}

// Every script, in the order index.html loads them.
function pageOrder() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  return [...html.matchAll(/src="src\/([a-z0-9]+\.js)"/g)].map(m => m[1]);
}

module.exports = { load, stubDom, stubAudio, node, pageOrder, SRC };
