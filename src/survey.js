/*
  The questionnaire, after the record.

  Up to here the experiment has only ever measured: how long the player waited,
  how many times they went back to a body. The record shows them those numbers
  and sorts them into a group on the strength of them. This is the part where
  it stops measuring and starts asking -- and every answer on offer is an
  admission. There is no way to answer none of it, and no answer that costs
  nothing, which is the design: the cheapest option is still "I gave in to my
  curiosity."

  Answers are keyed by their weight rather than by their position, and the
  positions are shuffled for every question. Three questions with the mildest
  answer always on the left is not a questionnaire, it is a dial the player
  learns to read in one move -- and a player who can see the scoring is
  answering the scoring rather than the question.

  Scores run 1 to 3 and nothing here interprets the total. The report that
  reads it comes next; this only hands over a number.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  // Answer text is keyed <question>.a<weight>, so the weight is the identity
  // of the answer and the order on screen can be anything.
  const QUESTIONS = [
    { key: 'survey.why' },
    { key: 'survey.justify' },
    { key: 'survey.felt' }
  ];

  const WEIGHTS = [1, 2, 3];
  const MIN = QUESTIONS.length * 1;
  const MAX = QUESTIONS.length * 3;

  function shuffled(rng) {
    const order = WEIGHTS.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const swap = order[i]; order[i] = order[j]; order[j] = swap;
    }
    return order;
  }

  PR.Survey = class {
    constructor(rng) {
      const random = rng || Math.random;
      this.index = 0;
      this.answers = [];
      // Laid out up front rather than per question, so the same run cannot
      // reshuffle a question the player is already looking at.
      this.pages = QUESTIONS.map(q => ({ key: q.key, order: shuffled(random) }));
    }

    current() { return this.done() ? null : this.pages[this.index]; }

    done() { return this.index >= this.pages.length; }

    // Records the weight of whatever was chosen and moves on. Returns the
    // weight, because the caller has a colour and a sound to pick from it.
    answer(weight) {
      if (this.done()) return null;
      this.answers.push(weight);
      this.index++;
      return weight;
    }

    total() { return this.answers.reduce((sum, w) => sum + w, 0); }

    // For whatever reads the total later: where it sits in the possible range.
    // Nothing here decides what that means.
    band() {
      const span = MAX - MIN;
      return span > 0 ? (this.total() - MIN) / span : 0;
    }
  };

  // Three readings of the same number, and the edges are deliberately one
  // score wide. A perfect 3 or a perfect 9 is one combination out of the
  // twenty-seven, so neither can be arrived at by shrugging: both mean the
  // player answered the same way three times running. Everything in between
  // -- which is twenty-five of the twenty-seven -- is the one told it has no
  // spine, and that is the joke. Almost everybody lands there.
  const VERDICTS = [
    { key: 'final.saved', upTo: 3 },
    { key: 'final.spineless', upTo: 8 },
    { key: 'final.pathetic', upTo: MAX }
  ];

  PR.Survey.verdictFor = function (total) {
    for (const verdict of VERDICTS) if (total <= verdict.upTo) return verdict.key;
    return VERDICTS[VERDICTS.length - 1].key;
  };

  PR.Survey.VERDICTS = VERDICTS;
  PR.Survey.QUESTIONS = QUESTIONS;
  PR.Survey.WEIGHTS = WEIGHTS;
  PR.Survey.MIN = MIN;
  PR.Survey.MAX = MAX;
})(window);
