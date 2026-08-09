/* Page-level metadata for a Flow3D deck. The visualizer has no splash gate:
   the first registered scenario is rendered by the engine immediately. */
window.FLOW3D = window.FLOW3D || {};

(function() {
  function applyDeck(def) {
    if (def.lang) document.documentElement.lang = def.lang;
    if (def.title) document.title = def.title;
    const canvas = document.getElementById('canvas');
    if (canvas && def.canvasLabel) canvas.setAttribute('aria-label', def.canvasLabel);
  }

  window.FLOW3D.deck = function(def) {
    def = def || {};
    window.FLOW3D.deckDefinition = def;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { applyDeck(def); }, {once: true});
    } else {
      applyDeck(def);
    }
  };
})();
