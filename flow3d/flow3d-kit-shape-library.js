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
     (rack, grid, client) still behaves as a single mesh downstream. */
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

  /* Rounds a convex polygon's corners in place: each vertex is replaced by a
     quadratic curve that stays inside the original edges. Standard trick —
     the sharp vertex becomes the curve's control point, so it never fully
     resolves the corner but reads as rounded from any typical camera angle. */
  function roundedPolygonShape(points, radius) {
    const shape = new THREE.Shape();
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      const toPrev = new THREE.Vector2().subVectors(prev, curr).normalize();
      const toNext = new THREE.Vector2().subVectors(next, curr).normalize();
      const p1 = new THREE.Vector2().copy(curr).addScaledVector(toPrev, radius);
      const p2 = new THREE.Vector2().copy(curr).addScaledVector(toNext, radius);
      if (i === 0) shape.moveTo(p1.x, p1.y); else shape.lineTo(p1.x, p1.y);
      shape.quadraticCurveTo(curr.x, curr.y, p2.x, p2.y);
    }
    shape.closePath();
    return shape;
  }

  /* Extrudes a 2D THREE.Shape (footprint in XZ) upward along Y, base at y=0.
     ExtrudeGeometry extrudes along +Z from the shape's own XY plane, so a
     -90° X rotation remaps that Z into our Y-up height axis. */
  function extrudeUp(shape, height, curveSegments) {
    const g = new THREE.ExtrudeGeometry(shape, {depth: height, bevelEnabled: false, curveSegments: curveSegments || 8});
    g.rotateX(-Math.PI / 2);
    return g;
  }

  /* Rounded rectangle in the X/Y plane (as the viewer faces it head-on),
     extruded along Z and centred on all three axes — the front-panel
     counterpart to `extrudeUp`'s top-down footprint rounding. Used for the
     `rack` shape's rounded slats/ports/slots. */
  function roundedPanelGeo(w, h, depth, corner) {
    const shape = roundedPolygonShape([
      new THREE.Vector2(-w / 2, -h / 2),
      new THREE.Vector2(w / 2, -h / 2),
      new THREE.Vector2(w / 2, h / 2),
      new THREE.Vector2(-w / 2, h / 2)
    ], corner);
    const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 8});
    g.translate(0, 0, -depth / 2);
    return g;
  }

  /* One rounded-diamond plate, centred on Y — the reusable tile behind both
     the generic `tiers` shape and the Redis-flavoured variant below. */
  function roundedDiamondLayerGeo(r, layerH, corner) {
    const N = new THREE.Vector2(0, r), E = new THREE.Vector2(r, 0), S = new THREE.Vector2(0, -r), W = new THREE.Vector2(-r, 0);
    const g = extrudeUp(roundedPolygonShape([N, E, S, W], corner), layerH);
    g.translate(0, -layerH / 2, 0);
    return g;
  }

  function starShape(outerR, innerR, points) {
    const shape = new THREE.Shape();
    const step = Math.PI / points;
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? outerR : innerR;
      const a = i * step - Math.PI / 2;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }

  function triangleShape(size, flip) {
    const shape = new THREE.Shape();
    const s = flip ? -1 : 1;
    shape.moveTo(-size * 0.5, size * 0.6);
    shape.lineTo(-size * 0.5, -size * 0.6);
    shape.lineTo(s * size * 0.55, 0);
    shape.closePath();
    return shape;
  }

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

  /* ── rack — buffer / queue (stacked rack units) ──
     Each slat now reads as its own rack-unit front panel — a row of port
     dashes on the left, a slot bar, and a round activity LED on the right —
     mirroring the stacked-server icon this shape is modelled on, instead of
     a bare stack of slabs. */
  KIT.SHAPE.rack = {
    kind: 'buffer / queue',
    slats: 3,
    geo: (w, h, d) => {
      const n = KIT.SHAPE.rack.slats;
      const gap = h * 0.08;
      const barD = d * 0.86;
      const barH = (h - gap * (n - 1)) / n;
      const slatCorner = Math.min(w * 0.86, barH) * 0.16;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const cy = -h / 2 + barH / 2 + i * (barH + gap);

        const slat = roundedPanelGeo(w * 0.86, barH, barD, slatCorner);
        slat.translate(0, cy, 0);
        parts.push(slat);

        // Front-panel texture, embossed just proud of the slat's face.
        const faceZ = barD / 2 + barH * 0.02;
        const nubD = barH * 0.06;

        const portCount = 5, portW = w * 0.03, portH = barH * 0.34, portGap = w * 0.045;
        const portsStartX = -w * 0.34;
        for (let p = 0; p < portCount; p++) {
          const port = roundedPanelGeo(portW, portH, nubD, portW / 2);
          port.translate(portsStartX + p * portGap, cy, faceZ);
          parts.push(port);
        }

        const slot = roundedPanelGeo(w * 0.16, barH * 0.16, nubD, barH * 0.08);
        slot.translate(w * 0.06, cy, faceZ);
        parts.push(slot);

        const led = new THREE.CylinderGeometry(barH * 0.18, barH * 0.18, barH * 0.06, 12);
        led.rotateX(Math.PI / 2);
        led.translate(w * 0.36, cy, faceZ);
        parts.push(led);
      }
      return parts;
    },
    face: (w, h, d) => d * 0.86 / 2,
    top:  (w, h, d) => h / 2,
    strip: null,
    edgeAngle: 1,
    state: 'count',
    stateMax: 3
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

  /* ── client — actor / device (client monitor silhouette) ──
     Reads as the desktop-monitor half of a client/server icon pair: a
     rounded-corner flat screen on top, a narrow neck, a wide flat foot on the
     bottom, plus a small embossed dot on the screen's lower bezel (camera /
     power light). Heights are fixed ratios of `h` (0.66 / 0.18 / 0.16) so the
     stack is always exactly `h` tall regardless of slot size.
     The screen's corners round in the X/Y plane (as the viewer sees it
     head-on), unlike `roundedPolygonShape`+`extrudeUp` elsewhere in this file
     which round a top-down XZ footprint — so it's built directly with
     ExtrudeGeometry along Z instead of reusing `extrudeUp`. `edgeAngle: 20`
     hides that rounding's facet seams the same way `tiers` does, while still
     keeping the screen/neck/foot silhouette lines. */
  KIT.SHAPE.client = {
    kind: 'client device (monitor)',
    geo: (w, h, d) => {
      const screenH = h * 0.66;
      const footH = h * 0.06;
      const neckH = h - screenH - footH;
      const neckW = w * 0.16;
      const neckD = d * 0.32;
      const footW = w * 0.9;
      const footD = d * 0.45;
      const screenD = d * 0.32;
      const corner = Math.min(w, screenH) * 0.14;
      const parts = [];

      const foot = boxGeo(footW, footH, footD);
      foot.translate(0, -h / 2 + footH / 2, 0);
      parts.push(foot);

      const neck = boxGeo(neckW, neckH, neckD);
      neck.translate(0, -h / 2 + footH + neckH / 2, 0);
      parts.push(neck);

      const screenShape = roundedPolygonShape([
        new THREE.Vector2(-w / 2, -screenH / 2),
        new THREE.Vector2(w / 2, -screenH / 2),
        new THREE.Vector2(w / 2, screenH / 2),
        new THREE.Vector2(-w / 2, screenH / 2)
      ], corner);
      const screen = new THREE.ExtrudeGeometry(screenShape, {depth: screenD, bevelEnabled: false, curveSegments: 8});
      screen.translate(0, h / 2 - screenH / 2, -screenD / 2);
      parts.push(screen);

      // Bottom-centre bezel dot, embossed just proud of the screen's front face.
      const dotR = Math.min(w, screenH) * 0.06;
      const dotShape = new THREE.Shape();
      dotShape.absarc(0, 0, dotR, 0, Math.PI * 2, false);
      const dot = new THREE.ExtrudeGeometry(dotShape, {depth: dotR * 0.6, bevelEnabled: false, curveSegments: 12});
      dot.translate(0, h / 2 - screenH + dotR * 2, screenD / 2);
      parts.push(dot);

      return parts;
    },
    face: (w, h, d) => d / 2,
    top:  (w, h, d) => h / 2,
    strip: (w) => w * 0.8,
    edgeAngle: 20
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

  /* ── tiers — layered store (stacked rounded-diamond plates, Redis-logo
     silhouette: a vertex points straight at the camera, not a flat face) ── */
  KIT.SHAPE.tiers = {
    kind: 'layered store',
    layers: 3,
    cornerRatio: 0.3, // corner rounding as a fraction of the diamond radius
    geo: (w, h, d) => {
      const n = KIT.SHAPE.tiers.layers;
      const r = Math.min(w, d) / 2;
      const corner = r * KIT.SHAPE.tiers.cornerRatio;
      const gap = h * 0.1;
      const layerH = (h - gap * (n - 1)) / n;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const g = roundedDiamondLayerGeo(r, layerH, corner);
        g.translate(0, -h / 2 + layerH / 2 + i * (layerH + gap), 0);
        parts.push(g);
      }
      return parts;
    },
    face: (w, h, d) => Math.min(w, d) / 2, // the vertex sits exactly on the front axis
    top:  (w, h, d) => h / 2,
    strip: (w, h, d) => Math.min(w, d) * 0.5,
    edgeAngle: 20, // hides the rounded-corner facet seams, keeps the crease lines that matter
    state: 'fill'
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

  /* ── redis — Redis-flavoured `tiers` variant, registered (not shared
     vocabulary) because its top plate carries product-specific marks. Star /
     oval / triangle / a fourth mark are embossed into the same merged solid
     rather than painted a separate colour: the shape contract gives every
     part exactly one tone-driven material (see file header — one mesh keeps
     fade/pop/raycast working), so the marks read via silhouette + shading,
     not a literal white-on-red fill. ── */
  KIT.defineShape('redis', {
    kind: 'layered cache (Redis)',
    layers: 3,
    cornerRatio: 0.3,
    geo: (w, h, d) => {
      const n = 3;
      const r = Math.min(w, d) / 2;
      const corner = r * 0.3;
      const gap = h * 0.1;
      /* The marks sit ON the top plate, so the plate stack has to give up
         exactly their height — otherwise the mesh is `h + emboss` tall, no
         longer centred on the origin, and `top()` reports a summit that is
         inside the marks (the flow anchor then hangs below the silhouette).
         emboss = layerH * 0.16, so solving
             layerH * n + gap * (n-1) + layerH * 0.16 = h
         for layerH keeps the whole silhouette exactly `h` tall. */
      const layerH = (h - gap * (n - 1)) / (n + 0.16);
      const emboss = layerH * 0.16;
      const stackH = h - emboss;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const g = roundedDiamondLayerGeo(r, layerH, corner);
        g.translate(0, -h / 2 + layerH / 2 + i * (layerH + gap), 0);
        parts.push(g);
      }
      const topY = -h / 2 + stackH;
      const mark = (geo, x, z) => { geo.translate(x, topY, z); parts.push(geo); };
      mark(extrudeUp(starShape(r * 0.22, r * 0.09, 5), emboss), r * 0.12, -r * 0.32);
      mark(new THREE.CylinderGeometry(r * 0.2, r * 0.2, emboss, 20).translate(0, emboss / 2, 0), -r * 0.35, -r * 0.02);
      mark(extrudeUp(triangleShape(r * 0.26), emboss), -r * 0.05, r * 0.3);
      mark(extrudeUp(triangleShape(r * 0.18, true), emboss), r * 0.34, -r * 0.16);
      return parts;
    },
    face: (w, h, d) => Math.min(w, d) / 2,
    top:  (w, h, d) => h / 2,
    strip: null,
    edgeAngle: 20,
    state: 'fill'
  });
})();
