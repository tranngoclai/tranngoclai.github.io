/* Unified scenario authoring registry and compiler.
   Authored steps remain untouched in `authoredSteps`; the engine consumes the
   derived `runtimePhases`. Scenario identity is always the stable `id` while
   `order` controls presentation only. */
(function() {
  const FLOW3D = window.FLOW3D = window.FLOW3D || {};
  const KIT = window.SCENE_KIT;
  const authored = [];
  const authoredById = new Map();
  const compiledById = new Map();
  const order = [];
  const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function fail(id, field, message) {
    throw new Error('[Flow3D scenario "' + (id || '<missing>') + '"] ' + field + ': ' + message);
  }

  function requiredString(id, value, field) {
    if (typeof value !== 'string' || !value.trim()) fail(id, field, 'must be a non-empty string');
  }

  function finiteNumber(id, value, field) {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(id, field, 'must be a finite number');
  }

  function finiteVector(id, value, field, length) {
    if (!Array.isArray(value) || value.length !== length) fail(id, field, 'must contain ' + length + ' numbers');
    value.forEach(function(n, i) { finiteNumber(id, n, field + '[' + i + ']'); });
  }

  function register(def) {
    def = def || {};
    requiredString(def.id, def.id, 'id');
    if (!ID_PATTERN.test(def.id)) fail(def.id, 'id', 'must use lowercase kebab-case');
    if (authoredById.has(def.id)) fail(def.id, 'id', 'is duplicated');
    const record = Object.assign({
      focusLabels: true,
      showPipeline: !!def.pipeline
    }, def);
    authored.push(record);
    authoredById.set(record.id, record);
    order.push(record.id);
    // Compatibility during the domain migration. After finalize this points
    // at compiled records, never at the authored objects.
    window.SCENARIOS = authored;
    return record;
  }

  function collectWorldKeys(sc) {
    const keys = new Set();
    const raw = {
      node: function(key, o) {
        requiredString(sc.id, key, 'world.node.key');
        if (keys.has(key)) fail(sc.id, 'world.node[' + key + ']', 'duplicates component key "' + key + '"');
        keys.add(key);
        o = o || {};
        finiteVector(sc.id, o.pos, 'world.node[' + key + '].pos', 3);
        finiteVector(sc.id, o.size, 'world.node[' + key + '].size', 3);
        if (o.order !== undefined) finiteNumber(sc.id, o.order, 'world.node[' + key + '].order');
        return {};
      },
      txt: function(text, x, y, z, color, orderValue) {
        finiteNumber(sc.id, x, 'world.txt.x');
        finiteNumber(sc.id, y, 'world.txt.y');
        finiteNumber(sc.id, z, 'world.txt.z');
        if (orderValue !== undefined) finiteNumber(sc.id, orderValue, 'world.txt.order');
      },
      cam: function(target, distance) {
        finiteVector(sc.id, target, 'world.camera.target', 3);
        if (distance !== undefined) finiteNumber(sc.id, distance, 'world.camera.distance');
      }
    };
    try { sc.world(raw); }
    catch (error) {
      if (String(error && error.message).indexOf('[Flow3D scenario') === 0) throw error;
      fail(sc.id, 'world', 'validation failed: ' + (error && error.message ? error.message : error));
    }
    return keys;
  }

  function validateKeys(sc, phase, field, value, keys, path) {
    const list = Array.isArray(value) ? value : Object.keys(value || {});
    list.forEach(function(key) {
      if (!keys.has(key)) fail(sc.id, path + '.' + field, 'references unknown component "' + key + '"');
    });
  }

  function compile(sc) {
    requiredString(sc.id, sc.name, 'name');
    requiredString(sc.id, sc.tag, 'tag');
    if (typeof sc.world !== 'function') fail(sc.id, 'world', 'must be a function');
    if (!Array.isArray(sc.steps) || !sc.steps.length) fail(sc.id, 'steps', 'must contain at least one authored step');
    if (sc.pipeline !== undefined && !Array.isArray(sc.pipeline)) fail(sc.id, 'pipeline', 'must be an array');

    const componentKeys = collectWorldKeys(sc);
    const runtimePhases = [];
    sc.steps.forEach(function(step, si) {
      const stepPath = 'steps[' + si + ']';
      requiredString(sc.id, step && step.title, stepPath + '.title');
      if (!step || (!step.desc && !(Array.isArray(step.phases) && step.phases.length))) {
        fail(sc.id, stepPath + '.desc', 'must provide a description directly or through phases');
      }
      if (step.phases !== undefined && (!Array.isArray(step.phases) || !step.phases.length)) {
        fail(sc.id, stepPath + '.phases', 'must be a non-empty array');
      }
      const phases = step.phases || [step];
      const split = !!step.phases;
      phases.forEach(function(phase, pi) {
        const path = stepPath + (split ? '.phases[' + pi + ']' : '');
        const pick = function(field) { return phase[field] !== undefined ? phase[field] : step[field]; };
        const description = pick('desc');
        requiredString(sc.id, description, path + '.desc');
        if (split) requiredString(sc.id, phase.title || step.title, path + '.title');

        const pipelineStep = pick('pipelineStep');
        if (pipelineStep !== undefined) {
          if (!Number.isInteger(pipelineStep)) fail(sc.id, path + '.pipelineStep', 'must be an integer');
          if (!sc.pipeline || pipelineStep < 0 || pipelineStep >= sc.pipeline.length) {
            fail(sc.id, path + '.pipelineStep', 'must be within 0..' + ((sc.pipeline && sc.pipeline.length || 0) - 1));
          }
        }
        ['focus', 'labels'].forEach(function(field) { validateKeys(sc, phase, field, pick(field) || [], componentKeys, path); });
        ['show', 'hide', 'showAt', 'hideAt', 'set'].forEach(function(field) { validateKeys(sc, phase, field, phase[field] || (Array.isArray(phase[field]) ? [] : {}), componentKeys, path); });

        const cam = pick('cam');
        if (cam !== undefined) finiteVector(sc.id, cam, path + '.cam', 3);
        const dist = pick('dist');
        if (dist !== undefined) finiteNumber(sc.id, dist, path + '.dist');
        ['showAt', 'hideAt'].forEach(function(field) {
          Object.keys(phase[field] || {}).forEach(function(key) { finiteNumber(sc.id, phase[field][key], path + '.' + field + '.' + key); });
        });
        Object.keys(phase.set || {}).forEach(function(key) {
          const look = phase.set[key] || {};
          if (look.pos !== undefined) finiteVector(sc.id, look.pos, path + '.set.' + key + '.pos', 3);
          if (look.at !== undefined) finiteNumber(sc.id, look.at, path + '.set.' + key + '.at');
        });

        runtimePhases.push({
          title: step.title,
          phaseTitle: phase.title || step.title,
          stepNo: si + 1,
          stepCount: sc.steps.length,
          phaseNo: pi + 1,
          phaseCount: phases.length,
          firstPhase: pi === 0,
          desc: description,
          focus: pick('focus') || [],
          labels: pick('labels') || [],
          cam: cam,
          dist: dist,
          pipelineStep: pipelineStep,
          set: phase.set || {},
          show: phase.show || [],
          hide: phase.hide || [],
          showAt: phase.showAt || {},
          hideAt: phase.hideAt || {},
          scene: phase.scene,
          scoreMode: phase.scoreMode !== undefined ? phase.scoreMode : (split ? undefined : step.scoreMode),
          scores: phase.scores || step.scores,
          scoreTitle: phase.scoreTitle || step.scoreTitle,
          build: step.build
        });
      });
    });
    if (!runtimePhases.length) fail(sc.id, 'runtimePhases', 'must contain at least one compiled phase');

    return Object.assign({}, sc, {
      authoredSteps: sc.steps.slice(),
      runtimePhases: runtimePhases,
      steps: runtimePhases,
      stepCount: sc.steps.length,
      phaseCount: runtimePhases.length,
      hasPhases: runtimePhases.some(function(phase) { return phase.phaseCount > 1; }),
      componentKeys: Array.from(componentKeys),
      compiled: true
    });
  }

  function finalize() {
    compiledById.clear();
    order.forEach(function(id) { compiledById.set(id, compile(authoredById.get(id))); });
    const compiled = order.map(function(id) { return compiledById.get(id); });
    window.SCENARIOS = compiled;
    return compiled;
  }

  FLOW3D.registry = {
    register: register,
    compile: compile,
    finalize: finalize,
    get: function(id) { return compiledById.get(id); },
    indexOf: function(id) { return order.indexOf(id); },
    ids: function() { return order.slice(); },
    scenarios: function() { return order.map(function(id) { return compiledById.get(id); }).filter(Boolean); }
  };

  KIT.scenario = register;
})();
