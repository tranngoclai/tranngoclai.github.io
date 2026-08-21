/* ══════════════════════════════════════════════
   SCENE KIT — WORLD BUILDER

   Wraps the engine's raw world context (`w.node` / `w.txt` / `w.cam`) with
   the layout rules the scenarios converged on. A scenario declares *what a
   component is*; the kit works out how it should look and where its caption
   goes.

   ── Rule 1 · ONE THING = ONE COMPONENT ──
   The persistent world is built once and never torn down, so a thing that
   moves must be the SAME box moving — declared here at its starting place
   and relocated by steps with `move()`. Drawing the subject again at each
   place it visits produces look-alike boxes the viewer has to re-identify
   every step, which is exactly the continuity the persistent world exists
   to provide.

   Likewise a component's verdict belongs ON the component (tone + badge),
   never on a separate chip standing beside it. Two boxes for one thing is
   two things as far as the viewer is concerned.

   ── Rule 2 · CAPTIONS ARE PRINTED ON THE FRONT FACE ──
   The engine's default floats a caption above the box, which stacks badly
   once components sit in rows: the caption of the back row lands on top of
   the front row. So the kit computes `labelPos` from the box's own geometry
   — centred on the front face, a hair proud of it — and every component in
   a world reads the same way. `caption:'top'` opts back out for the rare
   box that is too thin to print on.

   ── Rule 3 · A LABEL CARRIES NAME + CONFIGURATION, NOTHING ELSE ──
   `'Worker A\n11/12Gi'`, not `'Worker A — failed NodeResourcesFit'`. The
   label changes only when the configuration it states actually changes.
   Verdicts are colour and badge; explanation belongs in the panel text.
   A 3D scene that has to be *read* has stopped being a diagram.

   ── Rule 4 · STATUS KHÔNG NẰM TRONG CAPTION ──
   Caption in trên mặt trước là danh tính (tên + cấu hình) và phải đứng yên.
   Trạng thái — Pending, Running, Evicted — đi vào `status`, một chip riêng
   bay trên đầu component: `node('pod', {label:'Pod · P=0', status:'pending'})`
   và về sau `set: {'pod': KIT.mark('live','bound', {status:'running'})}`.
   Giá trị là *token* trong bảng NODE_STATUS (flow3d-engine-node-status-label.js),
   không phải chuỗi tự chế: một ký hiệu có màu + đúng một từ, để cùng một
   trạng thái luôn hiện cùng một hình ở mọi kịch bản.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;

/* Resolve a tone name (or a raw {col, edge} object) to a surface triple. */
function surface(tone) {
  if (!tone) return KIT.TONE.surface;
  if (typeof tone === 'object') return tone;
  return KIT.TONE[tone] || KIT.TONE.surface;
}
KIT.surface = surface;

/* Resolve an ink name to a colour. A TONE name resolves to that tone's flash
   colour, so a line drawn *to* a component can be named after the component's
   role rather than being matched by eye. A raw hex passes through. */
KIT.ink = function(ink) {
  if (!ink) return KIT.INK.info;
  if (KIT.INK[ink]) return KIT.INK[ink];
  if (KIT.TONE[ink]) return KIT.TONE[ink].flash;
  return ink;
};

/* ── Component ──
   node(key, {
     label,          name + configuration, '\n' for a second line
     pos:  [x,y,z],  home position — steps may move it from here
     size: [w,h,d],
     tone,           a TONE name, or {col, edge} to override outright
     order,          build order; also staggers the entrance animation
     hidden,         built but not revealed until a step shows it
     hover,          hover text; defaults to the label
     status,         trạng thái ban đầu — một token của NODE_STATUS, hiện
                     thành chip ký hiệu + một từ trên đầu component (rule 4)
     caption         'face' (default) · 'top' · [x,y,z] for a manual spot
     shape,          a SCENE_KIT.SHAPE id — what kind of thing this is,
                     orthogonal to tone/size (see flow3d-kit-shape-library.js).
                     Omit for the default 'box' — zero-change for old worlds.
     fill, count,    shape state at build time — see §3d of the shape
     open            registry proposal. Only the param the shape declares
                     support for (`SHAPE[shape].state`) has any effect.
   })
*/
KIT.world = function(w) {
  return {
    node(key, o) {
      const s = surface(o.tone);
      const [x, y, z] = o.pos;
      const [wid, hei, d] = o.size;
      const shapeDef = (KIT.SHAPE && KIT.SHAPE[o.shape]) || (KIT.SHAPE && KIT.SHAPE.box);

      // Front-face caption, centred both ways, derived from the shape's own
      // geometry so it stays correct when the box is resized, moved, or is
      // not a box at all.
      let labelPos = null;
      if (Array.isArray(o.caption)) labelPos = o.caption;
      else if (o.caption !== 'top') {
        const faceOff = shapeDef && shapeDef.face ? shapeDef.face(wid, hei, d) : d / 2;
        labelPos = [x, y, z + faceOff + KIT.FACE_GAP];
      }

      return w.node(key, {
        label: o.label || '',
        pos: o.pos,
        size: o.size,
        labelPos: labelPos,
        col:  o.col  || s.col,
        edge: o.edge || s.edge,
        order: o.order || 0,
        hidden: !!o.hidden,
        hover: o.hover || o.label || '',
        shape: o.shape,
        status: o.status,
        fill: o.fill, count: o.count, open: o.open
      });
    },

    /* Caption for a whole area of the world — floats above the components,
       not attached to any one of them. */
    region(text, x, z, order) {
      w.txt(text, x, 8, z || 0, 'rgba(140,168,204,.8)', order === undefined ? 12 : order);
    },

    /* Opening camera for the scenario. */
    cam(target, dist) { w.cam(target, dist); }
  };
};

/* Evenly spaced slots going down from a top position — a queue, a shelf, a
   stack of pending items. Returns the positions so a scenario can name them
   once and reference them from every step that moves something into one. */
KIT.stack = function(top, count, gap) {
  const out = [];
  for (let i = 0; i < count; i++) out.push([top[0], top[1] - i * (gap || 1.5), top[2]]);
  return out;
};
})();
