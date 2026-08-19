/*
  A pixel font, for the one thing in this game that speaks inside the picture.

  Everything else the game says to the player is DOM, because at 480x270
  there is no room for a sentence. This is the exception: the robot saying
  the player's name has to be *in* the scene, over its head, in the same
  material as the robot -- put it in a DOM layer and it becomes the game
  talking about the robot instead of the robot talking.

  Same notation as the emblems in logos.js: '#' is ink, '.' is nothing.

  The cell is 5 wide and 8 tall, with a fixed baseline so glyphs of different
  heights line up without any per-glyph tuning:

    row 0    marks above capitals
    row 1    cap and ascender top          (top: 1)
    row 2    x-height top                  (top: 2)
    row 5    baseline -- every letter ends here
    rows 6-7 descenders and cedillas

  A mark always sits one row above whatever it marks, so the same umlaut
  works on O and on o without a second copy of it. Turkish is not decoration
  here -- the name comes from a text field and will have the player's own
  spelling in it.
*/
(function (global) {
  'use strict';
  const PR = global.PR || (global.PR = {});

  const CELL = 5;          // glyph box width
  const ADVANCE = 6;       // and the gap to the next one
  const HEIGHT = 8;
  const BASELINE = 5;

  const CAP = 1, LOW = 2;

  // top is the row the first string sits on. Everything is written to finish
  // on the baseline, so a glyph's height is implied by its row count.
  const GLYPHS = {
    A: { top: CAP, rows: ['.###.', '#...#', '#####', '#...#', '#...#'] },
    B: { top: CAP, rows: ['####.', '#...#', '####.', '#...#', '####.'] },
    C: { top: CAP, rows: ['.###.', '#...#', '#....', '#...#', '.###.'] },
    D: { top: CAP, rows: ['####.', '#...#', '#...#', '#...#', '####.'] },
    E: { top: CAP, rows: ['#####', '#....', '####.', '#....', '#####'] },
    F: { top: CAP, rows: ['#####', '#....', '####.', '#....', '#....'] },
    G: { top: CAP, rows: ['.###.', '#....', '#..##', '#...#', '.###.'] },
    H: { top: CAP, rows: ['#...#', '#...#', '#####', '#...#', '#...#'] },
    I: { top: CAP, rows: ['.###.', '..#..', '..#..', '..#..', '.###.'] },
    J: { top: CAP, rows: ['..###', '...#.', '...#.', '#..#.', '.##..'] },
    K: { top: CAP, rows: ['#...#', '#..#.', '###..', '#..#.', '#...#'] },
    L: { top: CAP, rows: ['#....', '#....', '#....', '#....', '#####'] },
    M: { top: CAP, rows: ['#...#', '##.##', '#.#.#', '#...#', '#...#'] },
    N: { top: CAP, rows: ['#...#', '##..#', '#.#.#', '#..##', '#...#'] },
    O: { top: CAP, rows: ['.###.', '#...#', '#...#', '#...#', '.###.'] },
    P: { top: CAP, rows: ['####.', '#...#', '####.', '#....', '#....'] },
    Q: { top: CAP, rows: ['.###.', '#...#', '#...#', '#..#.', '.##.#'] },
    R: { top: CAP, rows: ['####.', '#...#', '####.', '#..#.', '#...#'] },
    S: { top: CAP, rows: ['.####', '#....', '.###.', '....#', '####.'] },
    T: { top: CAP, rows: ['#####', '..#..', '..#..', '..#..', '..#..'] },
    U: { top: CAP, rows: ['#...#', '#...#', '#...#', '#...#', '.###.'] },
    V: { top: CAP, rows: ['#...#', '#...#', '#...#', '.#.#.', '..#..'] },
    W: { top: CAP, rows: ['#...#', '#...#', '#.#.#', '##.##', '#...#'] },
    X: { top: CAP, rows: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] },
    Y: { top: CAP, rows: ['#...#', '.#.#.', '..#..', '..#..', '..#..'] },
    Z: { top: CAP, rows: ['#####', '...#.', '..#..', '.#...', '#####'] },

    a: { top: LOW, rows: ['.###.', '#..#.', '#..#.', '.####'] },
    b: { top: CAP, rows: ['#....', '#....', '###..', '#..#.', '###..'] },
    c: { top: LOW, rows: ['.###.', '#....', '#....', '.###.'] },
    d: { top: CAP, rows: ['...#.', '...#.', '.###.', '#..#.', '.###.'] },
    e: { top: LOW, rows: ['.##..', '#..#.', '###..', '.###.'] },
    f: { top: CAP, rows: ['..##.', '.#...', '###..', '.#...', '.#...'] },
    g: { top: LOW, rows: ['.###.', '#..#.', '#..#.', '.###.', '...#.', '###..'] },
    h: { top: CAP, rows: ['#....', '#....', '###..', '#..#.', '#..#.'] },
    k: { top: CAP, rows: ['#....', '#..#.', '#.#..', '##...', '#..#.'] },
    l: { top: CAP, rows: ['.#...', '.#...', '.#...', '.#...', '..##.'] },
    m: { top: LOW, rows: ['##.##', '#.#.#', '#.#.#', '#.#.#'] },
    n: { top: LOW, rows: ['###..', '#..#.', '#..#.', '#..#.'] },
    o: { top: LOW, rows: ['.##..', '#..#.', '#..#.', '.##..'] },
    p: { top: LOW, rows: ['###..', '#..#.', '#..#.', '###..', '#....', '#....'] },
    q: { top: LOW, rows: ['.###.', '#..#.', '#..#.', '.###.', '...#.', '...#.'] },
    r: { top: LOW, rows: ['#.##.', '##...', '#....', '#....'] },
    s: { top: LOW, rows: ['.###.', '##...', '..##.', '###..'] },
    t: { top: CAP, rows: ['.#...', '###..', '.#...', '.#...', '..##.'] },
    u: { top: LOW, rows: ['#..#.', '#..#.', '#..#.', '.###.'] },
    v: { top: LOW, rows: ['#...#', '#...#', '.#.#.', '..#..'] },
    w: { top: LOW, rows: ['#...#', '#.#.#', '#.#.#', '.#.#.'] },
    x: { top: LOW, rows: ['#..#.', '.##..', '.##..', '#..#.'] },
    y: { top: LOW, rows: ['#..#.', '#..#.', '#..#.', '.###.', '...#.', '###..'] },
    z: { top: LOW, rows: ['####.', '..#..', '.#...', '####.'] },

    // Dotless i is the base and the dotted one is built from it, which is the
    // right way round for Turkish and costs one glyph instead of two.
    'ı': { top: LOW, rows: ['.#...', '.#...', '.#...', '.#...'] },
    i: { top: CAP, rows: ['.#...', '.....', '.#...', '.#...', '.#...'] },
    'İ': { top: 0, rows: ['..#..', '.....', '.###.', '..#..', '..#..', '.###.'] },
    j: { top: CAP, rows: ['..#..', '.....', '..#..', '..#..', '..#..', '..#..', '##...'] },

    0: { top: CAP, rows: ['.###.', '#..##', '#.#.#', '##..#', '.###.'] },
    1: { top: CAP, rows: ['..#..', '.##..', '..#..', '..#..', '.###.'] },
    2: { top: CAP, rows: ['.###.', '#...#', '..##.', '.#...', '#####'] },
    3: { top: CAP, rows: ['####.', '....#', '.###.', '....#', '####.'] },
    4: { top: CAP, rows: ['#..#.', '#..#.', '#####', '...#.', '...#.'] },
    5: { top: CAP, rows: ['#####', '#....', '####.', '....#', '####.'] },
    6: { top: CAP, rows: ['.###.', '#....', '####.', '#...#', '.###.'] },
    7: { top: CAP, rows: ['#####', '....#', '...#.', '..#..', '..#..'] },
    8: { top: CAP, rows: ['.###.', '#...#', '.###.', '#...#', '.###.'] },
    9: { top: CAP, rows: ['.###.', '#...#', '.####', '....#', '.###.'] },

    '"': { top: CAP, rows: ['#.#..', '#.#..'] },
    "'": { top: CAP, rows: ['.#...', '.#...'] },
    '.': { top: BASELINE, rows: ['.#...'] },
    ',': { top: BASELINE, rows: ['.#...', '#....'] },
    '!': { top: CAP, rows: ['.#...', '.#...', '.#...', '.....', '.#...'] },
    '?': { top: CAP, rows: ['.###.', '#...#', '..##.', '.....', '..#..'] },
    '-': { top: 3, rows: ['.###.'] },
    ' ': { top: CAP, rows: [] }
  };

  // Marks sit one row above the glyph they belong to, so the same umlaut
  // serves O and o. A breve and a macron are the same three pixels at this
  // size; Turkish has no macron, so nothing is lost by admitting that.
  const UMLAUT = ['#.#..'];
  const BREVE  = ['###..'];
  const DOT    = ['.#...'];
  const CEDILLA = ['..#..', '.##..'];

  const MARKED = {
    'Ç': ['C', null, CEDILLA], 'ç': ['c', null, CEDILLA],
    'Ş': ['S', null, CEDILLA], 'ş': ['s', null, CEDILLA],
    'Ö': ['O', UMLAUT, null],  'ö': ['o', UMLAUT, null],
    'Ü': ['U', UMLAUT, null],  'ü': ['u', UMLAUT, null],
    'Ğ': ['G', BREVE, null],   'ğ': ['g', BREVE, null]
  };

  // Anything with no glyph draws as a hollow box, so a missing character is
  // visibly missing rather than a silent hole in a sentence.
  const TOFU = { top: CAP, rows: ['####.', '#..#.', '#..#.', '#..#.', '####.'] };

  function glyphOf(ch) {
    if (GLYPHS[ch]) return { g: GLYPHS[ch], above: null, below: null };
    const marked = MARKED[ch];
    if (marked && GLYPHS[marked[0]]) return { g: GLYPHS[marked[0]], above: marked[1], below: marked[2] };
    return { g: TOFU, above: null, below: null };
  }

  function stamp(raster, rows, x, top, color) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '#') raster.plot(x + c, top + r, color);
      }
    }
  }

  PR.font = {
    CELL: CELL,
    ADVANCE: ADVANCE,
    HEIGHT: HEIGHT,
    BASELINE: BASELINE,

    width(text) { return text.length ? text.length * ADVANCE - 1 : 0; },

    // Whether a character has a real glyph rather than the missing-character
    // box. The name comes from a text field, so this is how the tests check
    // that a Turkish alphabet does not turn into a row of boxes over a head.
    has(ch) { return !!(GLYPHS[ch] || (MARKED[ch] && GLYPHS[MARKED[ch][0]])); },

    // (x, y) is the top-left of the block, which is row 0 -- the mark row,
    // not the cap line. Callers position by the block so a string with an
    // umlaut in it does not sit one pixel lower than one without.
    draw(raster, text, x, y, color) {
      for (let i = 0; i < text.length; i++) {
        const at = x + i * ADVANCE;
        const found = glyphOf(text[i]);
        stamp(raster, found.g.rows, at, y + found.g.top, color);
        if (found.above) stamp(raster, found.above, at, y + found.g.top - found.above.length, color);
        if (found.below) stamp(raster, found.below, at, y + BASELINE + 1, color);
      }
    }
  };
})(window);
