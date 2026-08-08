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

/* ── mark ── the component entered a new state.
   Recolours it to the tone, bursts in that tone's flash colour, and pops a
   badge naming the change. This is the workhorse: a check failed, a
   candidate was selected, a resource was reserved.

     set: { 'node-a': KIT.mark('danger', 'capacity — fail', {at: 1.25, dy: 3.0}) }
*/
KIT.mark = function(tone, badge, o) {
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
*/
KIT.link = function(a, from, to, ink, o) {
  o = o || {};
  const at  = o.at  === undefined ? KIT.TIME.lead : o.at;
  const dur = o.dur === undefined ? KIT.TIME.draw : o.dur;

  const p1 = componentAnchor(from, at);
  const p2 = componentAnchor(to, at + dur);
  if (!p1 || !p2) return;

  a.flow([p1, componentArc(p1, p2, o.lift), p2], KIT.ink(ink), {
    at: at, dur: dur,
    loop: o.loop === undefined ? KIT.TIME.loop : o.loop,
    width: o.width
  });
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
   and a second one turns the frame back into a wall of text. */
KIT.note = function(a, text, pos, ink, at) {
  a.note(text, pos[0], pos[1], pos[2], KIT.ink(ink || 'mute'), at || 0);
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

   Link options (dur, loop, lift, width) go under `link`:
     KIT.beat('a', 'b', 'ok', {mark:[…], link: {dur:0.95, loop:3.8}})  */
KIT.beat = function(from, to, ink, o) {
  o = o || {};
  var linkOpts  = o.link || {};
  var linkAt    = linkOpts.at  !== undefined ? linkOpts.at  : KIT.TIME.lead;
  var linkDur   = linkOpts.dur !== undefined ? linkOpts.dur : KIT.TIME.draw;
  var linkLoop  = linkOpts.loop;
  var linkLift  = linkOpts.lift;
  var linkWidth = linkOpts.width;

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
      KIT.link(a, from, to, ink, lo);
    }
  };
};
})();
