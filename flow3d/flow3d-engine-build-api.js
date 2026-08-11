/* ─ Build API ─ */
let currentHeroIndex = -1;
let currentBoxMeshes = [];  // ordered list of meshes for hero selection
let heroRingObj = null;

/* Creates a box and its entrance animation, returning a node record that can be
   mutated later (used by the persistent-world scenarios). */
function addBox(label, x, y, z, w, h, d, col, edge, order, shape) {
  const delay = (order || 0) * 0.09;
  const {g, mesh, mat, edgeMat, stripMat, h: bh, anchorY, kind, stateOverlay} = makeSolid(shape || 'box', w, h, d, col, edge);
  g.position.set(x, y, z);
  buildAdd(g);

  g.scale.set(1, 0.001, 1);
  g.userData._baseY = y;
  g.userData._h = bh;

  const node = {
    g, mesh, mat, edgeMat, stripMat,
    x, y: y + bh/2, z, h: bh, baseY: y,
    anchorY, kind, stateOverlay,
    label: label || '', labelDiv: null,
    managed: false,   // true once a persistent world takes over its opacity
    entrance: 0,      // 0→1 while the box grows in
    cur: 1            // opacity target the world lerps toward
  };

  animQueue.push({
    type: 'box',
    group: g, mat, edgeMat, stripMat,
    baseY: y, h: bh,
    delay, duration: 0.5, t: -delay,
    persistent: buildPersistent,
    node
  });

  if (label) {
    node.labelDiv = addLabel(label, x, y + bh/2 + 0.45, z, 'rgba(192,208,232,.7)', delay + 0.3);
    node.labelObj = node.labelDiv._anchor;
  }
  return node;
}

function makeCtx() {
  const hovList = [];
  const boxMeshes = [];
  let heroIdx = -1;

  return {
    _hov: hovList,
    _heroIdx: () => heroIdx,
    _boxMeshes: () => boxMeshes,
    box(label, x, y, z, w, h, d, col, edge, order, shape) {
      const node = addBox(label, x, y, z, w, h, d, col, edge, order, shape);
      hovList.push({mesh: node.mesh, text: label || ''});
      boxMeshes.push(node);
      return node.mesh;
    },
    arrow(x1,y1,z1, x2,y2,z2, color, dashed, order) {
      const delay = (order || 0) * 0.09;
      const [line, cone] = makeArrow(x1,y1,z1, x2,y2,z2, color, dashed || false);
      buildAdd(line);
      buildAdd(cone);
      cone.scale.set(0.001, 0.001, 0.001);
      arrowQueue.push({line, cone, delay, duration: 0.4, t: -delay, dashed,
        p1: line.userData.p1, p2: line.userData.p2, color, persistent: buildPersistent});

      // spawn particle along non-dashed arrows after they draw
      if (!dashed) {
        makeParticle(line.userData.p1, line.userData.p2, color, delay + 0.5);
      }
    },
    /* Packet flow drawn as a growing arrow line. `opts` is in seconds:
       {at, dur, hold, loop, width} — share `loop` across a step's lines to keep
       their sequence in sync on every replay. */
    flow(points, color, opts) {
      makeFlowLine(points, color || '#3a7fff', opts);
    },
    txt(text, x, y, z, color, order) {
      const delay = (order || 0) * 0.09;
      addLabel(text, x, y, z, color || 'rgba(192,208,232,.6)', delay);
    },
    /* Same as txt() but the delay is given in seconds, to line a caption up
       with the flow or state change it describes. */
    note(text, x, y, z, color, at) {
      addLabel(text, x, y, z, color || 'rgba(192,208,232,.6)', at || 0);
    },
    hero(idx) {
      heroIdx = idx;
    },
    cam(target, dist) {
      startCamTween(target, dist);
    }
  };
}

/* ═══════════════════════════════════════════
   HOVER
══════════════════════════════════════════════ */
const ray = new THREE.Raycaster();
const mp  = new THREE.Vector2();
const popup = document.getElementById('popup');
let hovMeshes = [];
let lastHovMesh = null;

window.addEventListener('mousemove', function(e) {
  const rect = cvs.getBoundingClientRect();
  mp.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mp.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  ray.setFromCamera(mp, camera);
  const hits = ray.intersectObjects(hovMeshes.map(h => h.mesh));
  if (hits.length) {
    const h = hovMeshes.find(x => x.mesh === hits[0].object);
    if (h && h.mesh !== lastHovMesh) {
      popup.textContent = h ? h.text : '';
      popup.style.display = 'block';
      lastHovMesh = h.mesh;
    }
    popup.style.left = (e.clientX + 14) + 'px';
    popup.style.top  = (e.clientY - 36) + 'px';
  } else {
    popup.style.display = 'none';
    lastHovMesh = null;
  }
});
