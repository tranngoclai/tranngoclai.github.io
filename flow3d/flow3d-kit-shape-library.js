/* ══════════════════════════════════════════════
   SCENE KIT — SHAPE LIBRARY

   The vocabulary for *what kind of thing a component is*, orthogonal to
   TONE (role + verdict, `flow3d-kit-design-tokens.js`) and to SIZE (a
   deck's own `*-layout.js`). A node declares `shape: 'cylinder'`; everything
   else about the box stays exactly as it was.

   ── Contract every shape must satisfy ──
   `geo(w, h, d)` returns one or more `THREE.BufferGeometry`, each already
   centred on the origin, exactly `h` tall on Y, and no wider than `w`/`d` on
   X/Z. `makeSolid()` merges more-than-one part into a single BufferGeometry
   so a composite silhouette still raycasts, fades and pops as ONE mesh — see
   `flow3d-engine-animation-helpers.js`.

   `face`, `top` and `strip` tell the engine where to print the caption,
   where a flow line may anchor, and how wide the top highlight strip is
   (`null` when the shape has no flat top to put one on).

   `kind` is mandatory free text — it is the only thing a screen reader, a
   hover tooltip or forced-colors mode has to say what a silhouette means,
   so it must ship on every shape, including deck-registered ones.
══════════════════════════════════════════════ */

(function() {
  const KIT = window.SCENE_KIT;
  KIT.SHAPE = {};

  /* Concatenate n already-positioned geometries into one non-indexed
     BufferGeometry. EdgesGeometry and raycasting both work fine on a
     non-indexed mesh, and this is the whole reason a composite shape
     (rack, grid, capsule) still behaves as a single mesh downstream. */
  function mergeGeometries(geoms) {
    const flat = geoms.map(g => g.index ? g.toNonIndexed() : g);
    let total = 0;
    flat.forEach(g => { total += g.attributes.position.array.length; });
    const pos = new Float32Array(total);
    const norm = new Float32Array(total);
    let offset = 0;
    flat.forEach(g => {
      const p = g.attributes.position.array;
      const n = g.attributes.normal.array;
      pos.set(p, offset);
      norm.set(n, offset);
      offset += p.length;
    });
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    return merged;
  }
  KIT.mergeGeometries = mergeGeometries;

  function boxGeo(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

  /* ── box — service (the default; zero-change for every existing deck) ── */
  KIT.SHAPE.box = {
    kind: 'service',
    geo: (w, h, d) => [boxGeo(w, h, d)],
    face: (w, h, d) => d / 2,
    top:  (w, h, d) => h / 2,
    strip: (w) => w * 0.88,
    edgeAngle: 1
  };

  /* ── slab — platform / scenery (wide, flat, inert) ── */
  KIT.SHAPE.slab = {
    kind: 'platform / scenery',
    geo: (w, h, d) => [boxGeo(w, h, d)],
    face: (w, h, d) => d / 2,
    top:  (w, h, d) => h / 2,
    strip: null,
    edgeAngle: 1
  };

  /* ── cylinder — durable store ── */
  KIT.SHAPE.cylinder = {
    kind: 'durable store',
    geo: (w, h, d) => [new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, h, 20)],
    face: (w, h, d) => Math.min(w, d) / 2,
    top:  (w, h, d) => h / 2,
    strip: (w, h, d) => Math.min(w, d) * 0.72,
    edgeAngle: 25,
    state: 'fill'
  };

  /* ── hex — checkpoint / policy ── */
  KIT.SHAPE.hex = {
    kind: 'checkpoint / policy',
    geo: (w, h, d) => {
      const r = Math.min(w, d) / 2;
      const g = new THREE.CylinderGeometry(r, r, h, 6);
      g.rotateY(Math.PI / 6); // flat face forward, not a vertex
      return [g];
    },
    face: (w, h, d) => Math.min(w, d) / 2 * 0.87,
    top:  (w, h, d) => h / 2,
    strip: (w, h, d) => Math.min(w, d) * 0.65,
    edgeAngle: 1,
    state: 'open'
  };

  /* ── rack — buffer / queue (stacked slats) ── */
  KIT.SHAPE.rack = {
    kind: 'buffer / queue',
    slats: 4,
    geo: (w, h, d) => {
      const n = KIT.SHAPE.rack.slats;
      const gap = h * 0.06;
      const barH = (h - gap * (n - 1)) / n;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const g = boxGeo(w * 0.86, barH, d * 0.86);
        g.translate(0, -h / 2 + barH / 2 + i * (barH + gap), 0);
        parts.push(g);
      }
      return parts;
    },
    face: (w, h, d) => d * 0.86 / 2,
    top:  (w, h, d) => h / 2,
    strip: null,
    edgeAngle: 1,
    state: 'count',
    stateMax: 4
  };

  /* ── grid — aggregate (fixed 3x3 matrix; real cardinality lives in the
     label — see the shape-registry proposal's Q1: a shape's silhouette
     never resizes off a number, only its state overlay dims/lights up) ── */
  KIT.SHAPE.grid = {
    kind: 'aggregate',
    cols: 3, rows: 3,
    geo: (w, h, d) => {
      const cols = KIT.SHAPE.grid.cols, rows = KIT.SHAPE.grid.rows;
      const cw = w / cols * 0.78, cd = d / rows * 0.78;
      const parts = [];
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const g = boxGeo(cw, h, cd);
          g.translate(-w / 2 + cw / 2 + i * (w / cols), 0, -d / 2 + cd / 2 + j * (d / rows));
          parts.push(g);
        }
      }
      return parts;
    },
    face: (w, h, d) => d / 2,
    top:  (w, h, d) => h / 2,
    strip: null,
    edgeAngle: 1,
    state: 'count',
    stateMax: 9
  };

  /* ── capsule — actor / device ── */
  KIT.SHAPE.capsule = {
    kind: 'actor / device',
    geo: (w, h, d) => {
      const r = Math.min(w, d) / 2;
      const cylH = Math.max(0.001, h - 2 * r);
      const body = new THREE.CylinderGeometry(r, r, cylH, 16);
      const top = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      top.translate(0, cylH / 2, 0);
      const bottom = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      bottom.translate(0, -cylH / 2, 0);
      return [body, top, bottom];
    },
    face: (w, h, d) => Math.min(w, d) / 2,
    top:  (w, h, d) => h / 2,
    strip: null,
    edgeAngle: 30
  };

  /* ── seal — immutable commit ── */
  KIT.SHAPE.seal = {
    kind: 'immutable commit',
    geo: (w, h, d) => {
      const r = Math.min(w, d) / 2;
      const g = new THREE.CylinderGeometry(r, r, h, 8);
      g.rotateY(Math.PI / 8);
      return [g];
    },
    face: (w, h, d) => Math.min(w, d) / 2 * 0.92,
    top:  (w, h, d) => h / 2,
    strip: (w, h, d) => Math.min(w, d) * 0.75,
    edgeAngle: 1
  };

  /* A deck may register a shape id the shared vocabulary does not cover yet,
     but the definition still lives here in the shared registry (never a raw
     THREE.js call inside a scenario file) and still owes the a11y layer a
     text `kind` — see Rule "shape phải đọc được bằng chữ" in the proposal. */
  KIT.defineShape = function(id, def) {
    if (!def || typeof def.kind !== 'string' || !def.kind) {
      throw new Error('[flow3d] KIT.defineShape("' + id + '") needs a text kind');
    }
    if (typeof def.geo !== 'function') {
      throw new Error('[flow3d] KIT.defineShape("' + id + '") needs a geo(w,h,d) function');
    }
    KIT.SHAPE[id] = def;
  };
})();
