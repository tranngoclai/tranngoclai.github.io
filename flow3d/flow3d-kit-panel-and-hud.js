/* ══════════════════════════════════════════════
   SCENE KIT — PANEL COPY, HUD ROWS & SCENARIO ASSEMBLY

   The 2D half of the kit: what the viewer reads while the 3D half plays.

   ── The three-part explanation ──
   Every phase in both source scenarios settled into the same shape, and it
   is worth stating as a rule because it is what keeps a long deck from
   turning into a wall of prose:

     lead   ONE sentence. What happens in this beat. Bold, read first.
     body   The mechanism. Names, values, the actual steps.
     why    What the viewer would still get wrong without it — the
            misconception, the gotcha, the consequence. This is the part
            people remember, and a phase without one is usually a phase
            that did not need to exist.

   Inline emphasis inside `body`/`why` uses the panel's own classes, which
   carry the same meanings as the 3D tones:
     <code>       an identifier, a field, a literal value
     <b>          the load-bearing clause
     <span class="hi">      the subject under discussion
     <span class="ok">      a good outcome
     <span class="warn">    a provisional or risky state
     <span class="danger">  a failure or a hard "no"

   ── The metric HUD ──
   Two jobs, one widget, chosen by whether a row carries text:
     gauge()  a MEASUREMENT — "11/12Gi". The number is read, not counted.
     score()  a RATING — counts up to its value, and one row can wear a crown.
   Rows compare like against like, in a stable order across phases: keeping
   the same subjects in the same order is what lets a viewer read a
   before/after by looking at which row moved.

   ── The pipeline strip ──
   Stages of the mechanism the scenario walks, with the active one lit. A
   stage that destroys something should not look like a stage that creates
   something, hence `tone`. Steps and phases point at a stage by index, and
   pointing BACKWARDS is legitimate and often the whole lesson — a retry
   really does re-enter an earlier stage.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;

/* ── desc(lead, body, why) ──
   `body` may be an array; entries are joined with the separator that reads
   as "and also, at the same level" rather than as a new sentence.
   `why` is optional but should be rare to omit. */
KIT.desc = function(lead, body, why) {
  const mid = Array.isArray(body) ? body.join(' · ') : (body || '');
  return '<span class="lead">' + lead + '</span>'
       + mid
       + (why ? '<span class="why">' + why + '</span>' : '');
};

/* ── gauge(name, used, total, unit, o) ──
   A measurement row. The bar fills to used/total; the readout states both
   numbers so the viewer can check the bar against the arithmetic.
   o: {tone, win, txt} — `txt` replaces the default "used/total unit". */
KIT.gauge = function(name, used, total, unit, o) {
  o = o || {};
  const pct = Math.max(0, Math.min(100, Math.round(used / total * 100)));
  return {
    name: name,
    v: pct,
    txt: o.txt !== undefined ? o.txt : (used + '/' + total + (unit || '')),
    tone: o.tone,
    win: o.win
  };
};

/* ── score(name, value, o) ──
   A rating row: the number ticks up to `value`, because a score is arrived
   at rather than observed. `value` must be 0-100 — it drives both the bar
   width and the count-up. o: {win, tone, txt} — `txt` overrides the readout
   for a score whose "value" isn't a number a viewer should watch count up
   (a name, a verdict, a money amount) while still using `value` to size the
   bar. Same escape hatch gauge() already has. */
KIT.score = function(name, value, o) {
  o = o || {};
  return {name: name, v: value, txt: o.txt, win: o.win, tone: o.tone};
};

/* ── stage(icon, label, tone) ──
   One position on the pipeline strip. `tone` ('warn' | 'danger') recolours
   it while it is the active stage. */
KIT.stage = function(icon, label, tone) {
  return {icon: icon, label: label, tone: tone};
};

/* ── scenario(def) ──
   Registers a scenario with the kit's preferred defaults applied:

     focusLabels  ON. Captions are scoped to what the phase is talking
                  about. Every component keeps its shape on screen, but the
                  text layer carries one subject at a time instead of every
                  number at once — without this, a world of a dozen labelled
                  boxes reads as a spreadsheet.
     showPipeline ON whenever the scenario declares stages. Declaring
                  stages and then not showing them is always a mistake.

   A scenario overrides either by naming it explicitly. */
/* Installed by flow3d-engine-scenario-registry.js. Keeping scenario assembly
   out of this presentation helper ensures authored data is compiled once and
   addressed by stable id rather than mutable array position. */

/* ── sweep ── map a candidate list to a phase array.

   Three scenario steps walk one candidate per phase, structurally identical,
   differing only in key / tone / badge / copy.  After phase-02 those lists
   are model output, so generating the phases from that output removes the
   last place the candidate set is written by hand.

   `fn(item, index)` returns a plain phase object.  `sweep` wraps the
   result array so it can be assigned straight to `phases:`.

   Copy stays hand-written per candidate — the prose is the whole point of
   the deck and must not be templated.  Only the *structure* is generated.

     phases: KIT.sweep(run.filter.evaluated, (node, i) => ({
       title: node.name + (node.passed ? ' — pass' : ' — rejected: ' + node.plugin),
       desc:  DESCRIPTIONS[node.key],
       focus: ['scheduler', node.key],
       ...KIT.beat('scheduler', node.key, node.passed ? 'ok' : 'danger', {…})
     }))  */
KIT.sweep = function(items, fn) {
  return items.map(fn);
};

})();
