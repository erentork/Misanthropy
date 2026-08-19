/*
  Low-resolution raster.

  Canvas strokes are anti-aliased, which turns to mush when scaled up -- it
  does not read as pixel art. Instead we plot individual pixels into a
  480x270 ImageData and blow it up with an integer scale, so every edge
  stays crisp.
*/
(function (global) {
  'use strict';
  const PR = global.PR || (global.PR = {});

  // ImageData is little-endian: 0xAABBGGRR
  PR.rgb = (r, g, b, a) => (((a === undefined ? 255 : a) << 24) | (b << 16) | (g << 8) | r) >>> 0;
  PR.mix = (c0, c1, t) => {
    const p = (c, s) => (c >>> s) & 255;
    return PR.rgb(
      Math.round(p(c0, 0) + (p(c1, 0) - p(c0, 0)) * t),
      Math.round(p(c0, 8) + (p(c1, 8) - p(c0, 8)) * t),
      Math.round(p(c0, 16) + (p(c1, 16) - p(c0, 16)) * t));
  };

  class Raster {
    constructor(width, height) {
      this.width = width; this.height = height;
      this.canvas = document.createElement('canvas');
      this.canvas.width = width; this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d');
      this.image = this.ctx.createImageData(width, height);
      this.data = new Uint32Array(this.image.data.buffer);
    }

    clear(color) { this.data.fill(color); }

    plot(x, y, color) {
      x = x | 0; y = y | 0;
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
      this.data[y * this.width + x] = color;
    }

    block(x, y, size, color) {
      const o = -((size - 1) >> 1);
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) this.plot(x + i + o, y + j + o, color);
    }

    line(x0, y0, x1, y1, color, weight) {
      weight = weight || 1;
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        if (weight === 1) this.plot(x0, y0, color); else this.block(x0, y0, weight, color);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }

    circle(cx, cy, r, color) {   // midpoint, outline only
      cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
      let x = r, y = 0, err = 1 - r;
      while (x >= y) {
        this.plot(cx + x, cy + y, color); this.plot(cx + y, cy + x, color);
        this.plot(cx - y, cy + x, color); this.plot(cx - x, cy + y, color);
        this.plot(cx - x, cy - y, color); this.plot(cx - y, cy - x, color);
        this.plot(cx + y, cy - x, color); this.plot(cx + x, cy - y, color);
        y++;
        if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
      }
    }

    disc(cx, cy, r, color) {
      cx = Math.round(cx); cy = Math.round(cy);
      const rr = r * r;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
        if (x * x + y * y <= rr) this.plot(cx + x, cy + y, color);
    }

    // Tapered capsule: the one primitive the whole character is built from.
    // Round caps are what give limbs their weight -- square blocks along a
    // line look like scaffolding, not a body.
    capsule(x0, y0, x1, y1, r0, r1, color) {
      const minX = Math.floor(Math.min(x0 - r0, x1 - r1)), maxX = Math.ceil(Math.max(x0 + r0, x1 + r1));
      const minY = Math.floor(Math.min(y0 - r0, y1 - r1)), maxY = Math.ceil(Math.max(y0 + r0, y1 + r1));
      const dx = x1 - x0, dy = y1 - y0;
      const len2 = dx * dx + dy * dy;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          let t = len2 > 1e-9 ? ((x - x0) * dx + (y - y0) * dy) / len2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const px = x0 + dx * t, py = y0 + dy * t, r = r0 + (r1 - r0) * t;
          const ex = x - px, ey = y - py;
          if (ex * ex + ey * ey <= r * r) this.plot(x, y, color);
        }
      }
    }

    // Convex polygon fill by scanline. Filling by drawing lines along one
    // edge leaves gaps once the shape rotates; scanning rows never does.
    fillPolygon(points, color) {
      let top = Infinity, bottom = -Infinity;
      for (const p of points) { if (p.y < top) top = p.y; if (p.y > bottom) bottom = p.y; }
      const spans = [];
      for (let y = Math.floor(top); y <= Math.ceil(bottom); y++) {
        spans.length = 0;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const a = points[j], b = points[i];
          if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y))
            spans.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
        }
        if (spans.length < 2) continue;
        spans.sort((p, q) => p - q);
        for (let i = 0; i + 1 < spans.length; i += 2)
          for (let x = Math.round(spans[i]); x <= Math.round(spans[i + 1]); x++) this.plot(x, y, color);
      }
    }

    present(target, scale, ox, oy) {
      this.ctx.putImageData(this.image, 0, 0);
      target.imageSmoothingEnabled = false;
      target.drawImage(this.canvas, 0, 0, this.width, this.height,
        ox, oy, this.width * scale, this.height * scale);
    }
  }

  PR.Raster = Raster;
})(window);
