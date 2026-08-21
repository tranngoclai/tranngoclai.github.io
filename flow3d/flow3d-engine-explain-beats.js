/* ─ Explain beats ─
   Lời giải thích không nằm trong panel nữa, nó nằm TRONG cảnh và được chia
   thành từng nhịp. Một phase khai:

     explain: [
       {of: 'authn',                 text: 'Xác thực bằng certificate / token…'},
       {of: ['scheduler', 'queue'],  text: 'Scheduler đẩy Pod vào ActiveQ vì…'}
     ]

   Mỗi lần Next chơi đúng MỘT nhịp; hết nhịp thì Next mới sang phase kế. Phase
   không khai `explain` thì Next đi thẳng như cũ — không có nhịp rỗng nào.

   Camera do chính danh sách `of` quyết định, không cần tác giả chọn:
     · một node   → frameNodeKeys kẹp cự ly ở đáy dải (24) ⇒ phóng to sát nó,
                    bubble treo ngay trên đầu chủ thể.
     · nhiều node → cùng hàm tính span rộng hơn ⇒ camera lùi ra ôm cả nhóm,
                    bubble đặt ở TRỌNG TÂM nhóm chứ không dính vào một node,
                    vì lời giải thích đó không thuộc riêng ai.

   Bubble của nhịp không tự tắt theo giờ như KIT.bubble: nó đứng cho tới khi
   người xem bấm Next. Đọc xong mới đi tiếp là quyết định của người xem. */

let beatQueue = [];
let beatIndex = 0;
let beatBubble = null;
// Khung hình của nhịp vừa chơi. Ba nhịp liên tiếp cùng nói về `etcd` thì camera
// phải đứng yên: re-frame mà khung không đổi chỉ tạo một cú trôi nhẹ không mang
// thông tin, và mắt phải bắt lại chủ thể sau mỗi lần Next.
let beatFramedKeys = '';
const _beatAnchor = new THREE.Vector3();

function resetExplainBeats(step) {
  beatQueue = (step && step.explain) || [];
  beatIndex = 0;
  beatFramedKeys = '';
  dropBeatBubble();
}

function hasPendingBeat() {
  return beatIndex < beatQueue.length;
}

/* Nhịp đã đọc trong phase hiện tại — cho chỉ báo tiến trình và cho Prev. */
function playedBeatCount() { return beatIndex; }
function totalBeatCount() { return beatQueue.length; }
function hasPreviousBeat() { return beatIndex > 1; }

function dropBeatBubble() {
  if (beatBubble) fadeLabel(beatBubble);
  beatBubble = null;
}

/* Chỉ tính những node đang thật sự hiện: một nhịp trỏ vào component chưa được
   reveal thì thà đứng yên khung hình còn hơn zoom vào chỗ trống. */
function beatKeys(beat) {
  return [].concat(beat.of || []).filter(function(key) {
    return worldNodes[key] && worldNodes[key].visible;
  });
}

/* Neo cho bubble nhiều node: một Object3D rời, đặt ở trọng tâm nhóm. Không gắn
   vào scene graph — điểm này đứng yên nên chỉ cần updateMatrixWorld một lần,
   và nhờ vậy không có gì phải dọn khỏi scene khi nhịp kết thúc. */
function beatCentroidAnchor(keys) {
  _beatAnchor.set(0, 0, 0);
  keys.forEach(function(key) {
    const n = worldNodes[key];
    _beatAnchor.x += n.g.position.x;
    _beatAnchor.y += n.baseY + n.h;
    _beatAnchor.z += n.g.position.z;
  });
  _beatAnchor.divideScalar(keys.length);
  const obj = new THREE.Object3D();
  obj.position.copy(_beatAnchor);
  obj.updateMatrixWorld(true);
  return obj;
}

function beatTargetAnchor() {
  const obj = new THREE.Object3D();
  obj.position.copy(controls.target);
  obj.updateMatrixWorld(true);
  return obj;
}

function showBeatBubble(beat, keys) {
  const div = document.createElement('div');
  div.className = 'fl-label fl-bubble beat-bubble';
  div.innerHTML = beat.text;
  div.style.setProperty('--bubble-ink', window.SCENE_KIT.ink(beat.tone || 'accent'));
  labelsDiv.appendChild(div);

  const single = keys.length === 1;
  // Không node nào (nhịp nói về cả cảnh, hoặc chủ thể chưa hiện): treo ở tâm
  // khung hình hiện tại thay vì bỏ mất lời giải thích.
  const anchor = keys.length === 0 ? beatTargetAnchor()
    : (single ? worldNodes[keys[0]].labelObj : beatCentroidAnchor(keys));
  labelEls.push({
    div: div, obj: anchor, persistent: false,
    offset: [0, beat.dy === undefined ? (single ? 2.4 : 3.4) : beat.dy, 0]
  });
  div.classList.add('visible');
  beatBubble = div;
}

/* true = đã tiêu thụ cú Next này cho một nhịp giải thích. */
function playNextBeat(generation) {
  if (!hasPendingBeat()) return false;
  const beat = beatQueue[beatIndex++];
  const keys = beatKeys(beat);
  dropBeatBubble();

  if (keys.length) {
    const signature = keys.join('|');
    // Chủ thể không đổi → giữ nguyên khung hình, chỉ đổi lời.
    if (signature !== beatFramedKeys) {
      frameNodeKeys(keys, {});
      beatFramedKeys = signature;
    }
    // Nhịp nào nói về ai thì người đó sáng, phần còn lại lùi vào nền.
    applyFocus(keys, keys);
    // Chờ camera bắt đầu tới nơi rồi mới thả bubble — bubble bật ra giữa lúc
    // khung hình còn đang trôi thì mắt không biết nó đang chỉ vào cái gì.
    scheduleTransition(function() {
      if (!isFlowGenerationCurrent(generation)) return;
      showBeatBubble(beat, keys);
    }, 520, generation);
  } else {
    beatFramedKeys = '';
    showBeatBubble(beat, keys);
  }
  return true;
}

/* Prev đối xứng với Next: nhịp là đơn vị điều hướng, nên lỡ tay Next không được
   làm mất hẳn một lời giải thích. `beatIndex` trỏ tới nhịp KẾ, nên lùi hai bước
   rồi chơi lại chính là phát lại nhịp liền trước. */
function playPrevBeat(generation) {
  if (!hasPreviousBeat()) return false;
  beatIndex -= 2;
  // Buộc re-frame: khung hiện tại thuộc về nhịp vừa bị bỏ, không phải nhịp này.
  beatFramedKeys = '';
  return playNextBeat(generation);
}
