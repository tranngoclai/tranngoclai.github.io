/* ══════════════════════════════════════════════
   SCENE KIT — DESIGN TOKENS

   The vocabulary every scenario paints with. Nothing here mentions
   Kubernetes: a token names the **role a component plays in a story**
   ("the thing travelling", "the verdict is fail", "this is about to be
   destroyed"), not the thing itself. A scenario about a payment pipeline,
   a CI runner or a database replica set uses the same words.

   ── Why tokens at all ──
   The two scenarios this kit was extracted from carried ~200 raw hex
   literals between them, and the same semantic was spelled two or three
   different ways (`#0a2418` and `#0a2014` both meant "healthy"). A viewer
   learns a colour language in the first minute and then trusts it; two
   greens that mean the same thing quietly break that trust. One name →
   one triple, everywhere.

   ── The two families ──
   TONE — a *surface*: the three values a solid component needs.
       col   fill of the box
       edge  wireframe + top strip
       flash the burst colour when the component's state changes
   INK — a *mark*: a single colour for lines, notes and badges that are
       drawn over the scene rather than being a component.

   Both are plain data, so a scenario can still pass a raw hex anywhere a
   token is accepted when it genuinely needs a one-off colour.
══════════════════════════════════════════════ */

window.SCENE_KIT = window.SCENE_KIT || {};

/* ── Surfaces ──
   Ordered as a story reads them: infrastructure that just stands there,
   then the subject moving through it, then the verdicts. */
window.SCENE_KIT.TONE = {
  /* Inert scenery — a platform, a floor, a container that holds others. */
  surface: {col: '#0d1520', edge: '#1e3050', flash: '#3a7fff'},
  /* The hub everything else talks to. Biggest, brightest blue. */
  core:    {col: '#0a1830', edge: '#2a5a9a', flash: '#3a7fff'},
  /* A service or worker that acts on its own. */
  system:  {col: '#0a1428', edge: '#1a3a6a', flash: '#3a7fff'},
  /* A checkpoint the subject must pass through. */
  gate:    {col: '#0a2040', edge: '#1a4a80', flash: '#3a7fff'},
  /* Durable storage — the amber of "written down somewhere". */
  store:   {col: '#1a1200', edge: '#5a4000', flash: '#c08000'},
  /* A buffer things wait in. */
  queue:   {col: '#101a38', edge: '#2a4a90', flash: '#5a3acc'},
  /* Low-level machinery doing the physical work. */
  engine:  {col: '#1a1000', edge: '#5a3800', flash: '#c08000'},

  /* THE SUBJECT — the one component the whole scenario follows. Violet is
     reserved for it so the eye can always find it in a busy frame. */
  subject: {col: '#1e1a40', edge: '#5a3acc', flash: '#8b6cff'},
  /* Same kind of thing as the subject, but not the one being followed. */
  peer:    {col: '#151030', edge: '#3a2a70', flash: '#3a2a70'},

  /* Verdicts and outcomes. */
  live:    {col: '#0a2418', edge: '#1a6040', flash: '#22dd66'},  // healthy, running
  ok:      {col: '#0a2014', edge: '#1a7040', flash: '#22dd66'},  // passed a check
  warn:    {col: '#2a2000', edge: '#7a6010', flash: '#c08000'},  // provisional, reserved
  danger:  {col: '#200d10', edge: '#7a2028', flash: '#c43030'},  // failed a check
  doomed:  {col: '#2a0808', edge: '#8b1a1a', flash: '#c43030'},  // marked for destruction
  crown:   {col: '#2a2000', edge: '#fbbf24', flash: '#fbbf24'}   // the winner
};

/* ── Marks ──
   Flow lines, notes and badge text. `mute` is the only one that is not a
   statement — use it for the neutral "what just happened" caption. */
window.SCENE_KIT.INK = {
  info:   '#3a7fff',
  sky:    '#6aaaf8',
  accent: '#8b6cff',
  ok:     '#22dd66',
  pass:   '#18a855',
  warn:   '#c08000',
  danger: '#c43030',
  crown:  '#fbbf24',
  mute:   '#6a8ab0'
};

/* ── Timing ──
   A phase holds exactly one action, so everything happens inside the first
   ~1.5 seconds and then replays gently while the viewer reads. These are
   the defaults every helper falls back to; a phase overrides them only
   when its beat genuinely differs.

   `loop` is shared by every flow line in a phase so they replay in sync
   instead of drifting apart into visual noise. */
window.SCENE_KIT.TIME = {
  lead:  0.30,   // when a flow starts, after the phase lands
  draw:  1.05,   // how long a flow takes to travel
  loop:  3.70,   // full replay cycle, shared across the phase
  land:  1.20    // when a state change commits: after its flow arrives
};

/* Caption offset from a box's front face, in world units. Small enough to
   read as printed on the box, large enough to never z-fight with it. */
window.SCENE_KIT.FACE_GAP = 0.1;
