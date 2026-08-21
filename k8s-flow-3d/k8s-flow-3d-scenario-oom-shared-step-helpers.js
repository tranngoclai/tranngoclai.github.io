/* Shared by k8s-flow-3d-scenario-oom-killer-steps.js and
   k8s-flow-3d-scenario-node-wide-oom-steps.js — both scenarios' phases mark
   one component via KIT.beat() and then need to layer extra set-entries (a
   second component's mark, or just a status token) onto the very same
   moment the beat's own mark lands, without retyping that arrival time.

   This is choreography plumbing, not a domain value, so it does not belong
   in the model (§3 of the authoring guide). It must load after
   flow3d-kit-state-marks.js (reads KIT.TIME) and before both step files. */
(function() {
const KIT = window.SCENE_KIT;

window.mergeBeatState = function(beat, extra) {
  const set = Object.assign({}, beat.set);
  const first = Object.keys(beat.set)[0];
  const arrival = first ? beat.set[first].at : KIT.TIME.lead + KIT.TIME.draw;
  Object.keys(extra || {}).forEach(function(key) {
    set[key] = Object.assign({at: arrival}, set[key] || {}, extra[key]);
  });
  return {set: set, scene: beat.scene};
};
})();
