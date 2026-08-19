# Misanthropy

A physics sandbox: a pixel-art humanoid robot in side profile on a white page,
and three things to take it apart with. Grab it anywhere and throw it, aim with
the wheel, shoot limbs off with a shotgun, bury an axe in its head. Oil sprays
and stains the floor permanently. Bolts drop and stay where they fall.

It is also not only a sandbox. There is something else going on in it, and
working that out is most of the point — so this file does not say what.

No build step, no framework, no dependencies: about 6,000 lines of plain
JavaScript, HTML and CSS. Open `index.html` and it runs.

**[Play it →](https://erentork.github.io/Misanthropy/)**

---

## Running it locally

```bash
npx http-server -p 8124 -c-1 --silent
```

Then `http://localhost:8124/index.html`. Opening the file directly over
`file://` works too, which is why there are no ES modules — every script
attaches to one global and `index.html` *is* the load order.

```bash
node tests/checks.js
```

111 checks, no test framework and nothing to install.

## Controls

| Input | Effect |
|---|---|
| Spawn panel | Drop a shotgun, knife or axe into the scene at the cursor |
| Drag | Grab the nearest joint, limb, bolt or item; release to throw. Pull a buried blade hard to work it back out |
| Wheel | Aim what is held. A blade starts loose and swinging; the first notch latches it to that angle until you let go |
| Right click | Menu: delete the item under the cursor, clear all items, reset |
| `F` | Fire the held weapon |
| `1`–`5` | Armour level: 1 loses a limb to a couple of pellets, 5 takes several shells |
| `R` | New robot |
| `G` · `D` · `S` | Gravity · skeleton · body build |
| `Space` · `M` | Pause · sound |

---

## Physics

A Verlet solver in about 300 lines. Velocity is never stored — it is
`x - x_previous` — so constraints move positions directly, and collision
response, joint limits and the mouse grab all fall out of one mechanism.

**Fixed timestep, 1/120s, at most six substeps per frame.** Not optional:
Verlet derives velocity from the position delta, so a variable `dt` corrupts it
and the ragdoll explodes the moment the frame rate dips. Leftover time is
capped rather than accumulated, so a slow machine runs slow instead of
detonating.

**Joint limits are distance constraints, not angles.** An elbow cannot fold
past its range because shoulder-to-hand distance is clamped to 32–97% of the
arm length; same for knee, hip, shoulder and ankle. Cheaper than angular
constraints, and it composes with everything the solver already does.

**Hinge direction needs a constraint of its own.** Distance has no side, so a
distance limit alone lets a knee bend forwards. A `Bend` constraint keeps the
middle joint on one side of the axis through its neighbours and reads which
side from the rest pose — which is why the skeleton is built slightly bent at
every joint rather than straight.

### Dismemberment

Each limb owns the point at its own root, so a severed part takes its whole
capsule with it and the torso is left with a clean socket.

Breaking a joint is one call: `world.detach(partPoints)` drops every constraint
crossing the boundary. There is no per-limb bookkeeping anywhere — name the
part, and whatever held it on stops existing. A blade that has embedded itself
joins that part's set, which is why it rides away still buried in a limb that
later gets shot off, with no code that knows anything about blades.

Bolts are a fixed roster of sixteen and are not drawn while attached, so a bolt
on the floor always means something was hit. Once one drops it is gone from the
body for good and becomes an ordinary world point.

### Standing up took five wrong turns

An intact robot stands, because a limp target lying in a puddle is no fun to
shoot at. It was the hardest part of the project, and every failed version
looked correct on paper:

- **A one-sided pull injects momentum on every pass.** Sticks move both ends
  and cancel out; a servo pulling towards a target does not. The stance servo
  ended up as momentum-preserving shape matching with a single anchored world
  **x**. Anchoring **y** as well brings the levitation straight back.
- **Moving a point without moving its previous position creates velocity out of
  nothing.** That is how the first servo launched the robot off the top of the
  screen.
- **Servos correct positions; friction only acts on velocity.** So a servo can
  drag a planted foot sideways and no friction setting can stop it. That is why
  this robot does not walk.
- **Shape matching cannot stand a body up from lying down.** The matched pose
  puts the feet under the floor, the floor answers by squeezing, and the robot
  fires itself into the air. Softening the servo enough to prevent that left it
  unable to rise at all — 3 successes in 15 throws. Standing up is therefore
  driven rather than sprung: each point is walked towards its standing place at
  a fixed speed, carrying its previous position along so the move adds no
  momentum, with gravity bled off as it goes.
- **Rest poses have to respect the bone lengths and the joint limits.** A pose
  asking for an arm 20% shorter than it is will be silently defeated by the
  rigid sticks, and the limb simply never moves.

Measured over 15 throws at three strengths: 15 stood back up, in 1.7 to 4.0
seconds. A standing robot drifts under 1 px/s.

### Blades and impacts

**A blade bites by sweeping, not by touching.** The tip is raycast from where it
was to where it is on every substep, because a swung blade covers several pixels
in one and a per-frame test walks straight past a limb.

It sinks in proportion to impact speed — a knife between 2 and 14px — and then
stops dead, because by then it is *in* the limb rather than still travelling
through it. Three separate ceilings keep a wild swing from breaking the solver:
the speed the maths is allowed to see is clamped at 12px/substep, the depth is
capped by the thickness of the bone it hit, and every bond has a 2px minimum
length so a fully buried blade cannot hand the solver a degenerate constraint.
Tested at 20, 40 and 80px/substep: no NaN, bones stretched 2%.

**A blade is loose until you aim it.** Held with the wheel untouched it hangs
and swings from the hand like any other ragdoll. One notch latches it to that
angle and it holds while you carry and swing it — measured drift over three
seconds of being hauled around: 0 degrees — and the latch drops when you let
go. The gun does not work this way; it holds its angle the whole time.

**Impacts damage the joint that hit.** Contacts above 1.8px/substep leak oil,
structural damage needs 5.5, and anything working out below 4 points of damage
is ignored outright rather than accumulating — a tumbling body lands over and
over, and letting every tap count shook the robot apart the moment it touched a
wall. A harder throw is not always worse: land on the torso and nothing
structural happens, because the core has no joint to break.

---

## Rendering

Everything is plotted by hand into a 480×270 `ImageData` and blown up with an
integer scale. Canvas strokes are anti-aliased, which turns to mush when scaled
and stops reading as pixel art; plotting individual pixels keeps every edge
crisp at any window size.

The body is tapered capsules — round caps are what give a limb weight. Draw
order fakes the third dimension: far limbs, then torso and head, then near
limbs. Near limbs get a one-pixel paper halo before the ink pass, without which
the front arm and leg dissolve into the torso and the figure reads as one tube.
Segments come from the robot itself, so a limb that has been shot off keeps
drawing correctly while it tumbles away.

`src/pixelfont.js` is a 5×8 bitmap font written as rows of `#` and `.`, with the
Turkish alphabet in it. Three glyphs were wrong on the first pass and all three
looked fine as source: `a` was indistinguishable from `o`, `v` from `u`, and the
dot of `i` sat on its stem so it read as `l`. A font cannot be checked by
reading it — that was found by rendering a sheet to a PNG and looking at it.

---

## Sound

Every sound is synthesised at the moment it is asked for, out of a shared noise
buffer and a few oscillators. There are no audio files: the page has to keep
working over `file://`, where fetching a `.wav` is blocked outright. Twelve
one-shots and four sustained beds, in about 400 lines.

Nothing calls the synthesiser directly. Sounds are requested through
`fx.sound()`, because every site that would want one — a pellet landing, a blade
biting, a limb coming off — already holds the effects layer and already asks it
for spray and screen shake. An effects layer with nothing attached is silent,
which is how the headless suite stays quiet.

**Two buses.** The scene goes through a limiter and a duck; a second bus goes
straight to the master and is never ducked. That distinction is load-bearing:
sound belonging to an overlay has to survive the very screen that silences the
scene under it.

**A `tanh` waveshaper instead of a compressor.** Something has to hold the peaks
— a shotgun is three layers and a limb can come off in the same tick.
`DynamicsCompressorNode` does the job but looks ahead to do it: measured through
an `OfflineAudioContext`, 288 samples at 48kHz, or 6.0ms on every sound in the
scene. A waveshaper costs none. The curve is `tanh` across three times full
scale, verified sample-accurate — 0.1 in gives 0.0997 out, 3.0 gives 0.995 — so
normal signals pass untouched, peaks bend instead of clipping, and nothing
escapes above 1. Its `oversample` is `none` on purpose: every other setting
resamples, and resampling is the latency again.

### Latency, and being wrong about it

The first version felt late. Three sources, measured rather than guessed:

| Source | Cost |
|---|---|
| Jitter applied to every sound | 25ms mean, 50ms worst |
| `DynamicsCompressorNode` lookahead | 6.0ms |
| Browser and OS output latency | ~40ms, and not ours to fix |

The jitter was self-inflicted and the interesting one. It existed so nine
shotgun pellets resolving in the same tick would decorrelate into a rattle
rather than stack into one phasey click — but it was applied to *every* sound,
so a trigger pull with nothing to decorrelate against still waited an average of
25ms. It is a scheduling cursor now: the first of any sound goes out on the
instant, only repeats queue behind it, and past 60ms of queue the rest are
dropped rather than played late. The volley rattles better for it.

One further mistake worth recording: raising the master gain to compensate for
the gentler waveshaper was based on a guess at how much the compressor had been
doing. The guess was low, and the loudest sound came back 24% above the level it
had been signed off at. Measure the reference; do not reason about it.

Levels are recorded as measured peak amplitudes taken through an analyser on the
master bus. Two of the original figures were wrong in ways only measurement
could catch: a full-power impact came out level with the shotgun, and a scrape
came out inaudible because a narrow bandpass with a slow attack throws most of
its energy away. **The gain written in a sound is not the level that comes out
of it.**

---

## Testing

`node tests/checks.js` — 111 checks, no framework and no dependencies. The
sources are plain scripts, so the harness loads them with `eval` under a stub
DOM and drives them directly.

The suite measures rather than asserting vibes. Standing drift in px/s. Bone
stretch ratios. How many throws out of fifteen end with the robot back on its
feet. Whether an audio graph is *legal* — no NaN frequency, no exponential ramp
to or from zero, both of which are a `RangeError` in a browser and silence in a
forgiving stub. Whether the first instance of a sound is scheduled at
`currentTime` rather than later, which is the regression guard on the latency
work above.

It is the memory of everything that has actually broken here, and every number
printed next to a passing check is there so drift shows up before a failure
does.

---

## Internationalisation

Turkish and English, switchable at any time and remembered. All copy lives in
`src/i18n.js`, keyed; markup carries `data-i18n` attributes and holds no strings
of its own. 86 keys per language, and the suite fails if the two tables ever
drift apart. Values that change at runtime sit in their own elements outside the
translated span, or the swap would wipe them.

## Privacy

There are no network requests of any kind — no analytics, no fonts, no CDN, no
telemetry, no back end. Nothing this page holds ever leaves the browser it is
running in. `localStorage` holds four small things: language, sound preference,
and two pieces of session state.

---

## Layout

```
index.html        script order lives here; it is the load order
style.css         page chrome and overlays
src/raster.js     480x270 pixel raster: line, circle, tapered capsule, polygon fill
src/physics.js    Verlet solver: Point, Stick, Range, Bend, World
src/robot.js      20-point skeleton, parts, joint health, bolts, poses, stance servos
src/behaviour.js  which pose the robot holds, and why
src/items.js      shotgun, knife, axe: aiming, hitscan, blades that embed
src/fx.js         oil, permanent stains, tracers, screen shake, sound requests
src/audio.js      the synthesiser
src/render.js     drawing: robot, items, effects, four body builds
src/pixelfont.js  5x8 bitmap font, Turkish included
src/i18n.js       every string, both languages
src/input.js      mouse grab, wheel aim, fire, context menu
src/ui.js         spawn palette, right-click menu, language switch
src/main.js       fixed-step loop and scene wiring
tests/harness.js  loads the sources under a stub DOM
tests/checks.js   the regression suite
```

And these, which are the other thing this is, and are deliberately left
undescribed:

```
src/welcome.js   src/notice.js    src/ledger.js    src/logos.js
src/plea.js      src/survey.js    src/observer.js
```

Reading them spoils it. So do `DESIGN.md` and `HANDOFF.md` — the first is the
design reasoning behind that half, the second is an engineering handover
document, and neither keeps secrets.

---

Built by [erentork](https://github.com/erentork).
