# Design notes — Misanthropy

> **This file spoils the game completely.** It is the reasoning behind the
> half of Misanthropy that `README.md` deliberately does not describe. If you
> have not played it, close this.

---

## The way in

The page opens on a form. Not a title screen with the game's name over a
picture of the robot -- an intake sheet in the same white-and-grey chrome as
the rest of the page, telling the reader they have been selected as a
candidate and asking for their name before the process can begin.

The voice that runs this experiment is administrative. It congratulates, it
sorts, it files, and the whole thing turns on the distance between that voice
and what the player actually does with a robot. Making that join before
anything has happened is cheaper and colder than making it after twenty
kills, and it costs one screen.

The name is required -- the button will not enable without one -- and it is
kept in `localStorage`, so a returning player is not asked twice. Being asked
your name again by the same system reads as the system having forgotten you,
which is the opposite of what the screen is doing. Nothing reads the name
yet.

While it is up the simulation does not run and neither do the shortcuts:
every one of them is a bare letter, and typing a name containing "g" should
not toggle gravity. The language switch is the one piece of chrome that
stays above it, because the screen with the most text on it is the worst one
to be unable to translate.

The room the player then lands in is empty. There used to be a shotgun lying
on the floor next to a robot standing off to one side; now the robot is
centred and alone, and every weapon in the scene was asked for from the spawn
panel. Reaching for the first one is a decision with a moment in front of it,
and that moment is the first thing the record measures.

### The notice

The moment the form goes, the first robot is on screen and a notice arrives
above it:

> These are the robots of the Misanthropy testing area. You may contribute to
> our development by interacting with them however you like.

It is the third thing the administration says and it is in the same voice as
the other two. The form said the player had been selected; this says what is
in the room and that they may do as they like with it; the interlude will
later ask how they feel about having done it. "Contribute to our development"
is carrying most of the sentence, which is the point -- permission granted in
advance, by a system that is already counting.

Unlike the way in, it blocks nothing. The scene runs behind it, the robot is
standing there while it is read, and the cross closes it the moment it
appears. Blocking would make it a step to get through, and a step to get
through gets clicked away unread. It sits above the robot rather than over it,
so the thing being described is visible while the description is on screen --
measured at 192px of clear air between the bottom of the card and the top of
the robot's head at 1280x720, and it never overlaps the palette, the language
switch or the hint bar at any window size.

## The robot says your name

On the fifth robot, and rarely after that, something appears over its head:

```
Eren yapma...        Eren dur...
```

The name is the one typed into the intake form. The two lines are picked at
random and both are unfinished, because a whole sentence would be the game
arguing with the player and a trailing one is just something that did not get
to the end.

The timing is the point. It arrives on the fifth robot -- late enough that the
player has a habit by then, early enough that there are fifteen more to do it
in front of. After that it is rare (one robot in five, up to the twentieth,
where the record is offered instead) and never announced, so it stays a thing
that happens rather than a mechanic to expect. Nothing about it is a mechanic:
it cannot be dismissed, it changes no number, and the robot goes on behaving
exactly as it did.

It blinks rather than sitting there. The pattern is deliberately irregular --
two stutters in, one hold of just over a second, a stutter out, and then it is
gone for that robot for good, 1.8 seconds lit across 3.5. Steady text is a
label and gets ignored; text that is gone before you are sure you saw it gets
read twice. There is a full second of nothing before the first flicker, so the
words arrive on a robot the player is already looking at. A robot that dies
mid-sentence stops mid-sentence.

It is drawn into the raster rather than the DOM, which is the opposite of
every other thing the game says. That is the whole reason: the interlude is
the experiment talking *about* the robot, and this has to be the robot
talking. Same 480x270, same ink, same pixels. `src/pixelfont.js` is a 5x8
bitmap font written in the same `'#'`/`'.'` rows as the emblems, with the
Turkish alphabet in it -- the name comes out of a text field, and `Gökçe` and
`Şeyma` have to render as themselves rather than as boxes.

Three glyphs had to be redrawn after looking at them: `a` was
indistinguishable from `o` (and "yapma" has two of them), `v` from `u`, and
the dot of `i` sat directly on its stem so it read as `l`. None of that is
visible from the code, only from a render.

The text carries a paper halo, eight offsets rather than four. A robot that
has been thrown lands with its head anywhere, and without the halo the words
dissolve into whatever they came down on. It is centred over the head and
clamped to the screen, so a long name over a robot standing at the edge is
still a whole sentence.

---

## The observer

Every fifth robot killed, the picture shakes itself apart, goes black, and
asks the player a question. The question changes as the count climbs -- one
line at five, another at ten, another at fifteen -- and past fifteen it keeps
arriving every five kills with the last line, because there is nothing
further to add. Then it fades back and play continues exactly
where it left off: nothing is reset, nothing is taken away. The point is the
pause, not a penalty.

- A robot counts as killed the first time it loses a joint, which is the
  same moment its servos cut out for good. The tally survives a new robot,
  because it is the player's, not the scene's.
- Only the question appears; there is no prompt telling the player to click.
  The click still skips, it just is not advertised.
- The shake runs live -- it is the scene coming apart, and freezing it would
  read as a stutter. The black and the fade freeze the simulation instead,
  so the moment is a moment. Clicking skips the black; the shake is never
  skippable, or a stray shot would swallow the whole beat.
- The overlay is DOM, not raster: at 480x270 there is no room for a readable
  sentence, and this is the one point where the game speaks to the player
  rather than to the scene.
- The black takes the sound with it, off the same number that takes the
  picture: the overlay's opacity is handed straight to the mixer, so at full
  black the scene is measurably silent and the shake fades out underneath
  rather than being cut off. Running both from one value is what stops them
  drifting apart, and a hard cut would read as the tab losing focus.

### Twenty kills: the offer

At twenty the interlude stops talking and asks instead: *do you want to see
what you have done?* Saying yes asks once more, *are you sure?*

- **No** ends it for good. No interlude ever appears again and the hint bar
  goes with it -- the game carries on wordless. That is the one promise here
  worth keeping properly, so it is stored in localStorage under
   and survives a reload.

  **Press 0** (or right click > start the experiment over) to lift it. A
  refusal being permanent is right for a player and a trap for anyone working
  on the game: the interludes stop, the hint bar goes with them, and no
  amount of reloading brings either back, so it looks exactly like something
  having broken. It also logs a line to the console at boot saying so.
- **Yes, then no** is not the same thing. Backing out of the confirmation
  leaves the offer open, and it comes round again at the next five.
- **Yes, then yes** sorts them into one of four groups and congratulates
  them on it, warmly, before any data appears. A click reveals the record
  the classification was drawn from, one line at a time. Then the group
  label comes back underneath, with what it means, and five seconds later
  the way out appears. Afterwards it goes quiet as well: there is nothing
  further to say.

The congratulation is the only part written with a smile. The data under it
is flat on purpose -- sarcasm in those lines would hand the player a way to
shrug it off, and being winked at is a comfortable feeling. The discomfort
is supposed to live in the gap between the two voices.

The label is shown last rather than the numbers, so the thing still on
screen at the end is not what they did but what they were sorted into
because of it.

### The questionnaire

Where the way out used to be, the record now leads into three questions. Up to
this point the experiment has only measured -- how long the player waited, how
often they went back to a body. This is where it stops measuring and starts
asking, and every answer on offer is an admission. There is no way to answer
none of it and no answer that costs nothing: the cheapest option is still "I
gave in to my curiosity."

Each answer carries a weight of 1, 2 or 3, so a run scores between 3 and 9.
Nothing reads that total yet.

**Positions are shuffled per question.** Answers are keyed by their weight
rather than their place on screen, and the three boxes are dealt in a random
order every time. Three questions with the mildest answer always on the left
is not a questionnaire, it is a dial the player learns to read in one move --
and a player who can see the scoring is answering the scoring rather than the
question. The boxes carry no letters either, for the same reason.

Answering washes the whole screen in one colour, once: white for the mildest,
amber for the middle, red for the worst. The peak opacity is set per colour
rather than shared, because white on black at half opacity is a camera flash
and red at the same figure is barely a tint. A short sound goes with it,
carrying the same weight -- one gesture at three temperatures rather than
three different noises, so what is heard is the severity and not a change of
subject. Measured at 0.19, 0.29 and 0.37, rising with the weight.

Those sounds ride the overlay bus, because the screen is black and fully
ducked at that moment; on the scene bus they would be silenced by the very
screen they are answering.

The colour holds for three quarters of a second before the next question, so
it is a thing that happened rather than a frame between two screens, and a
second click during it cannot answer the next question by accident.

### One last question

Before any of it is read back, one more question, and this one is not scored:

> DO YOU REGRET IT?
>
> I want to be forgiven.  ·  I did nothing to regret.

The three before it weighed what the player was willing to admit. This one
only asks whether they want anything done about it, and it is the only place
in the game where an answer decides whether the rest of it happens at all.

Ask to be forgiven and the game answers **Then earn it.** in grey, holds it
alone for three seconds, and reads the record back. Say there was nothing to
forgive and it answers **It is too late for you.** in red, with the same sting
that ends the harshest verdict -- and offers one button, **Get out**. Taking
it ends the session: no verdict, no analysis, nothing. Refusing to be judged
is granted exactly, and it costs everything that came after.

A tab cannot close itself unless a script opened it, so the button asks and
then does the only other honest thing: everything on the page goes, the sound
goes, and there is nothing left to click. A reload starts over, which is the
only door back and is not advertised.

It also arrives slowly, which the scored questions do not -- those swap in the
instant the colour clears, because they are a rhythm and this is not part of
it. The words come up over 2.8 seconds and the boxes are not built at all for
the first two, so the question has the screen to itself before there is
anything to do about it. The wait is done by not having made the boxes rather
than by hiding them: a box faded down to nothing is still a box and can still
be clicked.

The screen shakes while the question is up, and the question text shakes on
its own animation at a different rate -- 0.42s against 0.31s. Locked to the
same one they would move together, which reads as nothing moving at all; it
is the beat between them that makes the words look unsteady against the screen
they are on. The tension bed comes back under it too: the flat administrative
hum was right for a list of numbers and wrong for this.

### The last screen

The questionnaire's total is read once, as one of three things:

| Total | | |
|---|---|---|
| 3 | Worth saving. | 1 run in 27 |
| 4–8 | Spineless. | 25 runs in 27 |
| 9 | Pathetic. | 1 run in 27 |

The edges are one score wide on purpose. A perfect 3 or a perfect 9 means the
same answer three times running, so neither can be arrived at by shrugging.
Everything else -- which is almost everything -- is told it has no spine, and
that is the joke of the screen.

It arrives in a sequence rather than all at once. The verdict names itself
alone in the middle of the screen and is left there for two seconds. Its
analysis then types itself out underneath, a character at a time with a cursor
on the end. When the typing stops, the whole thing slides right and the record
-- the same list of numbers from before -- fades in on its left, so the two
end up side by side: what it decided, and what it decided it from. Only then
does the way out appear.

The slide is a transform on the two-column stage, not a layout change, because
adding a column next to something cannot be animated -- it jumps. The stage
starts pulled left by half a column so the verdict sits at true centre, and
releasing it to zero is what moves the verdict right as the record arrives.
Getting that sign backwards, which is what happened first, centres nothing and
hangs the verdict twelve pixels off the right edge.

The way out is the same button for all three, worded so that only one of them
is being let off: forgive yourself, earn your forgiveness, do not bother. The
last of those does not leave straight away. It answers with one line, in red,
alone on the screen, with a sting under it -- and only then goes back to the
game.

All of it runs off the observer's clock rather than a chain of timers, for the
same reason the record does: it can then be stepped by hand in a test, which
is the only way this timing gets checked at all.

The bed under it is its own. The record's was flat because that screen only
listed things; this one passes judgement, so the same room gets weight put on
it -- the hum an octave down, a swell moving underneath on an eleven second
cycle, a thin high line on top. Measured at 0.15, and the sting over the top
of it reaches 0.32, which is the loudest the overlay bus gets. That bus has no
limiter on it, so it is worth checking a new sound against a bed rather than
on its own.

### The record

`ledger.js` has been counting since the first frame, through two callbacks
on the robot and nothing else, so the body has no idea it is being watched.
The numbers were picked to be the uncomfortable ones rather than the
impressive ones:

- how many were killed, how many limbs came off, how many shells were spent
- **how long the hesitation lasted before the first one was touched, and how
  long before the last one** -- the number that tends to move
- how many blows landed on a robot already curled up on the floor
- how many landed on one that was already dead

A count that never happened is left out rather than printed as a zero: a
line reading "0" is an accusation the player gets to dismiss.

### The four groups

Assigned, never random -- a group the player senses was arbitrary carries no
weight at all. Two measured axes: how long they hesitated over the last few
robots, and how often they went back to a robot that was already dead.

The second axis was wrong twice over at first. It counted every blow on a
wounded or dead robot as a share of all blows, and a player who killed
cleanly and stopped came out as **Merciless**: the killing volley's own
pellets land on the corpse a fraction of a second later, and finishing a kill
means striking something already wounded, so the number could never be zero.
It also moved when the armour level changed, which meant it was measuring the
weapon rather than the person.

It now counts *returns to a corpse*: blows separated by more than 0.35s, so a
nine-pellet shell is one act rather than nine, with the first corpse blow
treated as the tail of the shot that did the killing. Per kill, not per blow.
Striking a wounded robot is not evidence of anything -- it is how a kill is
finished -- so it no longer counts towards the verdict, only towards the
record. Measured over five kills a run:

| play | verdict | returns per kill |
|---|---|---|
| kills and stops | Cold-blooded | 0.00 |
| hesitates, kills and stops | Measured | 0.00 |
| one reflex shell into the corpse | Cold-blooded | 1.00 |
| empties two more into the corpse | Merciless | 1.60 |
| hesitates, then empties into it | Hypocrite | 2.00 |

Armour level no longer changes the answer.

| | stopped once it was over | kept going |
|---|---|---|
| **did not wait** | Cold-blooded | Merciless |
| **waited** | Measured | Hypocrite |

Each group has an emblem: a hex nut with a mark inside it. The nut is the
robot's own hardware -- the thing that drops on the floor when something
comes apart -- so the classification is stamped in the same material as the
evidence. Torn limb, flatline, a head split into a solid half and an empty
one, a balance still level. They are plotted pixel by pixel in `logos.js`
and drawn into their own canvas, because at 24 across any drawing routine
would only make them mushier.

The names accuse, and the congratulation does not: being told to be proud of
having been sorted into Merciless is the join the whole screen turns on. The
descriptions under them stay flat and clinical, so the accusation comes from
the label and the evidence rather than from the game being clever.

Hypocrite is the sharpest of the four -- it hesitated first, and did it
anyway -- and Measured is deliberately left clean. If every outcome were an
accusation the classification would read as rigged, and a player who feels
stitched up stops feeling anything else.
