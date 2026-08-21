/* ══════════════════════════════════════════════
   SCENE KIT — STATE MARKS & CHOREOGRAPHY

   A phase changes the world in exactly three ways, and each has one helper
   here so the intent is readable at the call site instead of buried in a
   literal object:

     mark()   the component's state changed and it now LOOKS different
     pulse()  something happened TO it, but its state is unchanged
     move()   the component went somewhere — the same box, travelling

   All three return a plain `set` entry, so they compose with anything the
   engine accepts and a scenario can still hand-write an entry when it needs
   something none of these covers.

   ── Why `at` matters ──
   `at` (seconds) is what makes a state change *play* instead of appearing
   pre-applied. Give a mark the moment its flow line arrives and the viewer
   sees cause then effect; leave it off and the world is simply already in
   its new state when the phase opens. Both are legitimate — but a change
   the phase is *about* should almost always be played.

   ── Why `dy` matters ──
   Badges float above the component. On a low flat platform 3.0 clears it;
   on a small box 2.2 sits right; the defaults below match those two cases
   and a caller overrides only for unusual geometry.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;

/* Everything a caller may add on top of a mark: `at`, `dy`, `hover`,
   `label`, `pos`. Copied last so an explicit value always wins. */
function extend(base, o) {
  return Object.assign(base, o || {});
}

/* A badge is a tag naming the change, not the explanation of it — that belongs
   in the phase's own `desc`. A badge much longer than a short tag widens the
   pill enough to make it collide with neighbouring labels, so authors get a
   one-time console nudge instead of discovering the overlap on screen. */
const BADGE_LEN_WARN = 28;
const badgeLenWarned = {};
function warnBadgeLength(badge) {
  if (!badge || badge.length <= BADGE_LEN_WARN || badgeLenWarned[badge]) return;
  badgeLenWarned[badge] = true;
  console.warn('[flow3d] badge is ' + badge.length + ' chars, longer than a tag should be — consider moving detail into desc(): "' + badge + '"');
}

/* ── mark ── the component entered a new state.
   Recolours it to the tone, bursts in that tone's flash colour, and pops a
   badge naming the change. This is the workhorse: a check failed, a
   candidate was selected, a resource was reserved.

     set: { 'node-a': KIT.mark('danger', 'capacity — fail', {at: 1.25, dy: 3.0}) }
*/
KIT.mark = function(tone, badge, o) {
  warnBadgeLength(badge);
  const s = KIT.surface(tone);
  return extend({col: s.col, edge: s.edge, flash: s.flash, badge: badge}, o);
};

/* ── pulse ── something happened, but the component is what it was.
   Badge + flash, no recolour. Use it for the component that *performs* an
   action rather than the one that changes because of it — a scheduler
   emitting a decision, a server acknowledging a write.

     set: { 'scheduler': KIT.pulse('accent', 'decision emitted', {at: 0.55, dy: 3.9}) }
*/
KIT.pulse = function(ink, badge, o) {
  warnBadgeLength(badge);
  return extend({flash: KIT.ink(ink), badge: badge}, o);
};

/* ── move ── the same box goes somewhere else.
   The engine tweens it along an arc, so the viewer follows one object
   instead of losing it and finding a look-alike elsewhere. Pass `tone` when
   arriving also changes what the thing IS (queued → running).

     set: { 'pod': KIT.move(POS.nodeA, {tone: 'live', badge: 'Running', at: 1.05}) }
*/
KIT.move = function(pos, o) {
  o = o || {};
  const base = o.tone ? KIT.mark(o.tone, o.badge) : {flash: KIT.ink(o.ink || 'accent'), badge: o.badge};
  const rest = Object.assign({}, o);
  delete rest.tone; delete rest.ink; delete rest.badge;
  return extend(Object.assign(base, {pos: pos}), rest);
};

/* ── link ── a packet travelling from ONE COMPONENT TO ANOTHER.
   This is how a phase draws an arrow. Name the two components and the engine
   works out the geometry: the line leaves dead-centre on the source's top
   face and lands dead-centre on the target's, with an arc sized to the gap
   between them (see flow3d-engine-component-anchors.js).

     scene(a) { KIT.link(a, 'apiserver', 'etcd', 'warn', {at: 0.30}); }

   Never hand-type endpoints. A component that gets resized or relocated must
   carry its arrows with it, and two arrows in one scene must agree on what
   "leaves this box" looks like — neither survives coordinates typed by eye.

   Both ends resolve against the world *at the moment the line touches them*:
   the source when it departs (`at`), the target when it arrives (`at + dur`).
   So a line aimed at a Pod that moves mid-phase ends where the Pod will be.

   Options: {at, dur, loop, width} as for KIT.flow, plus `lift` — extra arc
   height, to fan several lines that share an endpoint apart from each other.
   A raw [x,y,z] is accepted in place of a key for the rare line that points
   at a place rather than at a thing.

   `label` names the action the arrow is performing (e.g. "watch", "POST
   binding") and is required for every call-site — an arrow with no caption
   forces the viewer to guess what crossed the wire. It renders as a caption
   floating at the arc's high point, tinted to the arrow's own `ink` unless
   `labelColor` overrides it. On a looped arrow the line itself blinks off
   between redraws, so the caption's opacity is driven frame-by-frame off the
   same draw/hold/fade curve as the line — the two disappear and reappear
   together instead of the caption sitting there orphaned once the line has
   faded. `labelDy` nudges it clear of a line with an unusually tall arc.
*/
KIT.link = function(a, from, to, ink, o) {
  o = o || {};
  const at  = o.at  === undefined ? KIT.TIME.lead : o.at;
  const dur = o.dur === undefined ? KIT.TIME.draw : o.dur;

  const p1 = componentAnchor(from, at);
  const p2 = componentAnchor(to, at + dur);
  if (!p1 || !p2) return;

  const mid = componentArc(p1, p2, o.lift);
  const dy = o.labelDy === undefined ? 0.5 : o.labelDy;
  a.flow([p1, mid, p2], KIT.ink(ink), {
    at: at, dur: dur,
    loop: o.loop === undefined ? KIT.TIME.loop : o.loop,
    width: o.width,
    label: o.label,
    labelDy: dy,
    labelColor: o.labelColor || KIT.ink(ink)
  });
};

/* ── chain ── một chuỗi hop đi thẳng tới đích, KHÔNG quay đầu: A → B → C.
   Vẽ n−1 mũi tên trong CÙNG một phase, mũi sau khởi hành đúng lúc mũi trước
   cập bến, nên mắt đọc ra một chuyển động liên tục thay vì phải bấm Next giữa
   chừng và ghép lại trong đầu. Dùng khi các hop chỉ là chặng của một hành
   trình; nếu một chặng là quyết định riêng (thắng/trượt, rẽ nhánh, có thể
   quay lại) thì nó xứng đáng một phase của nó và KHÔNG thuộc về chain.

     const t = KIT.chain(a, ['client','authn','admission','apiserver'], 'info', {
       labels: ['POST deployments', 'authorize · RBAC', 'admit request'],
       at: 0.35, dur: 0.85
     });
     // t = [{at, arrive}, …] — dùng để hẹn mark/status đúng nhịp hop cập bến:
     set: { 'admission': KIT.mark('ok', 'validate ✓', {at: t[1].arrive}) }

   Cả chain dùng chung một chu kỳ `loop` (mặc định = độ dài toàn chuỗi + nghỉ)
   nên khi lặp lại nó chạy lại từ A, không phải ba mũi tên nhấp nháy lệch pha.
   `inks` đổi màu từng hop khi ý nghĩa mỗi chặng khác nhau. */
/* Lịch của chuỗi, tách riêng để `set` (viết trước, ngoài scene) và `scene`
   cùng đọc MỘT nguồn thay vì gõ tay hai bộ số rồi lệch nhau khi chỉnh nhịp:

     const HOP = KIT.chainTimes(3, {at: 0.35, dur: 0.85});
     set:   { 'authn': KIT.mark('ok', 'RBAC allow', {at: HOP[0].arrive}) }
     scene: KIT.chain(a, keys, 'info', {at: 0.35, dur: 0.85, labels: […]}) */
KIT.chainTimes = function(count, o) {
  o = o || {};
  const dur = o.dur === undefined ? KIT.TIME.draw : o.dur;
  const gap = o.gap === undefined ? 0.12 : o.gap;
  const hops = [];
  let at = o.at === undefined ? KIT.TIME.lead : o.at;
  for (let i = 0; i < count; i++) {
    hops.push({at: at, arrive: at + dur});
    at += dur + gap;
  }
  return hops;
};

KIT.chain = function(a, keys, ink, o) {
  o = o || {};
  const dur = o.dur === undefined ? KIT.TIME.draw : o.dur;
  const labels = o.labels || [];
  const inks = o.inks || [];
  const hops = KIT.chainTimes(keys.length - 1, o);
  const span = hops.length ? hops[hops.length - 1].arrive : 0;
  const loop = o.loop === undefined ? span + (o.hold === undefined ? 1.2 : o.hold) : o.loop;

  hops.forEach(function(hop, i) {
    KIT.link(a, keys[i], keys[i + 1], inks[i] || ink, {
      at: hop.at, dur: dur, loop: loop, lift: o.lift,
      label: labels[i], labelDy: o.labelDy, width: o.width
    });
  });
  return hops;
};

/* ── flow ── the raw form: an explicit polyline through given points.
   Kept for the line that is genuinely about a path rather than about two
   components. If you are naming a source and a target, use KIT.link.

     scene(a) { KIT.flow(a, [[from], [arc], [to]], 'danger', {at: 0.30}); }
*/
KIT.flow = function(a, points, ink, o) {
  o = o || {};
  a.flow(points, KIT.ink(ink), {
    at:   o.at   === undefined ? KIT.TIME.lead : o.at,
    dur:  o.dur  === undefined ? KIT.TIME.draw : o.dur,
    loop: o.loop === undefined ? KIT.TIME.loop : o.loop,
    width: o.width
  });
};

/* ── note ── a caption anchored in the scene for this phase only.
   One per phase at most: it is the phase's headline inside the 3D frame,
   and a second one turns the frame back into a wall of text.

   `ref` names the component the caption is ABOUT, exactly as KIT.link names
   its endpoints — so a caption follows the box it explains when that box is
   moved or resized, and a step that reframes its camera around its focus
   still has the caption inside the frame. Hand-typed coordinates could do
   neither: they are correct only for the layout they were eyeballed in.

     KIT.note(a, 'working_set = usage − inactive_file', 'cgroups', 'warn', .4)
     KIT.note(a, '④ cycle thất bại', {of: 'scheduler', band: true}, 'mute', 1)

   Two placements, and the choice says what kind of caption it is:

     over   (default) the caption belongs to ONE component and floats just
            above it, close enough that the pairing needs no arrow.
     band   the caption is the phase's own headline rather than a fact about
            one box. It drops to KIT.NOTE_BAND — a single height shared by the
            whole deck — so consecutive summary notes sit on one line instead
            of stepping up and down with whatever geometry they hang off.

   `dx` / `dz` / `dy` nudge from there, for the rare case where two captions in
   one phase would otherwise overlap. */

/* Caption band: one height for every summary note in the deck, below the
   ground plane so a headline never collides with the badges above a box. */
KIT.NOTE_BAND = -3.6;

/* Clearance above a component's top face for an `over` caption: higher than a
   badge (KIT.mark's `dy` tops out near 3.0) so the two can coexist. */
const NOTE_LIFT = 2.2;

function notePos(ref, t) {
  if (Array.isArray(ref)) return ref.slice();

  const o = typeof ref === 'string' ? {of: ref} : (ref || {});
  const p = componentAnchor(o.of, t);          // dead-centre on the top face
  if (!p) return null;

  const y = o.band ? KIT.NOTE_BAND : p[1] + NOTE_LIFT;
  return [p[0] + (o.dx || 0), y + (o.dy || 0), p[2] + (o.dz || 0)];
}

KIT.note = function(a, text, ref, ink, at) {
  const pos = notePos(ref, at || 0);
  if (!pos) return;
  a.note(text, pos[0], pos[1], pos[2], KIT.ink(ink || 'mute'), at || 0);
};

/* ── bubble ── a short, component-anchored explanation. Unlike a note, several
   bubbles may be visible at once because each belongs to a particular actor. */
KIT.bubble = function(a, key, text, o) {
  o = o || {};
  addBubble(text, key, o);
};

/* ── beat ── a link AND the state-change it causes, in one call.

   The coupling that matters between a flow line and the target's mark is
   timing: the mark must land at or after `lead + dur`, otherwise the
   target changes state BEFORE the line reaches it — breaking the
   "cause then effect" rule this kit is built around.

   `KIT.beat` encodes that constraint: it draws the link, computes
   `at = linkAt + dur` for the mark by default, and returns a plain
   `{set, scene}` pair that the phase spreads into its own fields:

     ...KIT.beat(from, to, ink, {
       mark: ['ok', 'NodeResourcesFit ✓'],   // [tone, badge] for the target
       dy: 3.0,                                // badge offset on the target
       hover: 'passed — enough capacity'       // optional tooltip
     })

   Call-sites spread the result into their phase:

     { title, desc, focus, labels, ...KIT.beat('scheduler','node-a','ok',{…}) }

   An explicit `at` in the mark options still wins — a phase that
   deliberately marks early or late keeps that power.

   Link options (dur, loop, lift, width, label, labelDy, labelColor) go under `link`:
     KIT.beat('a', 'b', 'ok', {mark:[…], link: {dur:0.95, loop:3.8}})  */
KIT.beat = function(from, to, ink, o) {
  o = o || {};
  var linkOpts  = o.link || {};
  var linkAt    = linkOpts.at  !== undefined ? linkOpts.at  : KIT.TIME.lead;
  var linkDur   = linkOpts.dur !== undefined ? linkOpts.dur : KIT.TIME.draw;
  var linkLoop  = linkOpts.loop;
  var linkLift  = linkOpts.lift;
  var linkWidth = linkOpts.width;
  var linkLabel = linkOpts.label;
  var linkLabelDy = linkOpts.labelDy;
  var linkLabelColor = linkOpts.labelColor;

  /* arrival = when the line touches the target component */
  var arrival = linkAt + linkDur;

  /* Build the mark on the target, defaulting `at` to the arrival time. */
  var markArgs = o.mark || [];            // [tone, badge]
  var markTone  = markArgs[0] || ink;
  var markBadge = markArgs[1] || '';
  var markOpts  = {};
  if (o.dy    !== undefined) markOpts.dy    = o.dy;
  if (o.hover !== undefined) markOpts.hover = o.hover;
  if (o.label !== undefined) markOpts.label = o.label;
  if (o.flash !== undefined) markOpts.flash = o.flash;
  // A verdict has to outlive its own phase. The badge is torn down with the
  // step layer and never re-created on replay, so a beat whose whole point is
  // a conclusion ("this Node passed") must also write a status chip — that is
  // the channel setNodeLook replays, and the only one that survives the next
  // Next.
  if (o.status !== undefined) markOpts.status = o.status;
  markOpts.at = (o.at !== undefined) ? o.at : arrival;

  var setEntry = {};
  setEntry[to] = KIT.mark(markTone, markBadge, markOpts);

  return {
    set: setEntry,
    scene: function(a) {
      var lo = {at: linkAt, dur: linkDur};
      if (linkLoop  !== undefined) lo.loop  = linkLoop;
      if (linkLift  !== undefined) lo.lift  = linkLift;
      if (linkWidth !== undefined) lo.width = linkWidth;
      if (linkLabel !== undefined) lo.label = linkLabel;
      if (linkLabelDy !== undefined) lo.labelDy = linkLabelDy;
      if (linkLabelColor !== undefined) lo.labelColor = linkLabelColor;
      KIT.link(a, from, to, ink, lo);
    }
  };
};
})();
