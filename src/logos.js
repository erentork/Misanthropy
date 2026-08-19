/*
  Group emblems.

  Each is a hex nut with a mark inside it. The nut is deliberate: it is the
  robot's own hardware, the thing that drops on the floor when something
  comes apart, so the classification is stamped in the same material as the
  evidence.

  Drawn as pixels into their own canvas rather than as an image, so they stay
  crisp at any size and cost nothing to ship. The marks are hand-plotted
  because the shapes are 10 pixels across and any drawing routine would only
  make them mushier.

  '#' ink, '+' metal, '.' nothing.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  const SIZE = 24;

  // Torn off. The ragged top edge is what makes it read as a limb that came
  // away rather than a bar.
  const MERCILESS = [
    '#..##..#',
    '##.##.##',
    '.######.',
    '.######.',
    '.######.',
    '.######.',
    '.######.',
    '.######.',
    '..####..',
    '...##...',
    '..#..#..',
    '.#....#.'
  ];

  // Flatline, with one last beat on it.
  const COLD = [
    '..............',
    '......##......',
    '......##......',
    '#####.##.#####',
    '..............'
  ];

  // Two faces: the same head, one side solid, the other only an outline.
  const HYPOCRITE = [
    '...####...',
    '.########.',
    '####..###.',
    '####...###',
    '####....##',
    '####....##',
    '####...###',
    '####..###.',
    '.########.',
    '...####...'
  ];

  // A balance, still level.
  const MEASURED = [
    '......##......',
    '......##......',
    '##############',
    '#.....##.....#',
    '#.....##.....#',
    '###...##...###',
    '.#....##....#.',
    '......##......',
    '....######....',
    '...########...'
  ];

  const MARKS = { A: MERCILESS, B: COLD, C: HYPOCRITE, D: MEASURED };

  function plot(grid, x, y, v) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    grid[y * SIZE + x] = v;
  }

  function build(letter) {
    const grid = new Uint8Array(SIZE * SIZE);
    // Hex nut, flat top and bottom. Spelled out row by row rather than
    // drawn from trigonometry: at 24 pixels across, a computed hexagon comes
    // out with ragged corners and a doubled edge where the lines meet.
    const TOP = 2, BOTTOM = 21;
    const spans = [];
    for (let i = 0; i <= 6; i++) spans.push([8 - i, 15 + i]);   // widening
    for (let i = 0; i < 6; i++) spans.push([2, 21]);            // straight sides
    for (let i = 6; i >= 0; i--) spans.push([8 - i, 15 + i]);   // narrowing
    spans.forEach(([left, right], i) => {
      const y = TOP + i;
      if (y === TOP || y === BOTTOM) {
        for (let x = left; x <= right; x++) plot(grid, x, y, 1);
      } else {
        plot(grid, left, y, 1);
        plot(grid, right, y, 1);
      }
    });

    const mark = MARKS[letter] || MARKS.D;
    const w = mark[0].length, h = mark.length;
    const ox = Math.round((SIZE - w) / 2), oy = Math.round((SIZE - h) / 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = mark[y][x];
        if (c === '#') plot(grid, ox + x, oy + y, 1);
        else if (c === '+') plot(grid, ox + x, oy + y, 2);
      }
    }
    return grid;
  }

  // Light on black: these only ever appear on the interlude's own screen.
  const INK = '#ededed';
  const METAL = '#8f8f8f';

  PR.drawLogo = function (canvas, letter, scale) {
    scale = scale || 5;
    canvas.width = SIZE * scale;
    canvas.height = SIZE * scale;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grid = build(letter);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const v = grid[y * SIZE + x];
        if (!v) continue;
        ctx.fillStyle = v === 1 ? INK : METAL;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return canvas;
  };

  PR.logoGrid = build;   // exposed for tests
  PR.LOGO_SIZE = SIZE;
})(window);
