/* ─ Node status label ─
   Status của một component KHÔNG nằm trong caption của nó. Caption (label giữa,
   ngay trên thân box) chỉ mang danh tính: tên + cấu hình tĩnh — thứ không đổi
   suốt kịch bản. Status thì đổi liên tục, nên nó có riêng một label bay cao hơn
   một nấc, ngay trên đầu component:

       ▶ RUNNING     ← status label (đổi theo từng phase)
       ┌──────────┐
       │ Worker A │  ← caption: tên + cpu 4/16 (đứng yên)

   Cách biểu diễn: một ký hiệu + đúng MỘT từ. Ký hiệu mang màu của tone nên
   quét mắt là biết tốt/xấu; một từ để người xem không phải đoán ký hiệu nghĩa
   gì. Muốn gọn hơn nữa (chỉ còn ký hiệu) thì ẩn `.node-status .w` trong CSS —
   từ vẫn còn trong tooltip. Câu giải thích dài thuộc về `desc` của phase, badge
   tạm thời lo phần "vừa mới đổi thành gì". */

/* Sát ngay trên nóc box. Chip phải đọc như một phần của chính component —
   đẩy nó lên cao là nó thành một nhãn trôi nổi không rõ của ai, nhất là khi
   nhiều component đứng gần nhau. Caption in ở mặt trước (rule 2) nên khoảng
   trên nóc còn trống cho chip. */
const NODE_STATUS_LIFT = 0.42;

/* Token → {ký hiệu, từ, mực}. Kịch bản viết `status: 'running'`, không tự chế
   chuỗi — nhờ vậy cùng một trạng thái luôn hiện cùng một hình ở mọi kịch bản.
   Token lạ được hiển thị nguyên văn (mực mute) để không chặn tác giả. */
const NODE_STATUS = {
  pending:     {g: '◌', w: 'Pending',  ink: 'mute'},
  queued:      {g: '≡', w: 'Queued',   ink: 'info'},
  scheduling:  {g: '◐', w: 'Filter',   ink: 'info'},
  bound:       {g: '⌖', w: 'Bound',    ink: 'accent'},
  assigned:    {g: '⇩', w: 'Assigned', ink: 'info'},
  synced:      {g: '⇄', w: 'Synced',   ink: 'info'},
  creating:    {g: '◐', w: 'Creating', ink: 'warn'},
  pulling:     {g: '↓', w: 'Pulling',  ink: 'warn'},
  starting:    {g: '▷', w: 'Starting', ink: 'warn'},
  running:     {g: '▶', w: 'Running',  ink: 'ok'},
  ready:       {g: '✓', w: 'Ready',    ink: 'ok'},
  passed:      {g: '✓', w: 'Pass',     ink: 'pass'},
  rejected:    {g: '✕', w: 'Fail',     ink: 'danger'},
  throttled:   {g: '≈', w: 'Throttled', ink: 'warn'},
  pressure:    {g: '▲', w: 'Pressure', ink: 'warn'},
  terminating: {g: '◼', w: 'Terminating', ink: 'danger'},
  evicted:     {g: '⇥', w: 'Evicted',  ink: 'danger'},
  killed:      {g: '✕', w: 'Killed',   ink: 'danger'},
  full:        {g: '█', w: 'Full',     ink: 'danger'},
  winner:      {g: '★', w: 'Winner',   ink: 'crown'}
};

const statusWarned = {};
function nodeStatusHtml(status) {
  const s = NODE_STATUS[status];
  if (!s) {
    // Gần như luôn là dấu hiệu tác giả nhét một câu mô tả vào `status` thay vì
    // một token — chip sẽ dài ngoằng và không còn là trạng thái nữa.
    if (!statusWarned[status]) {
      statusWarned[status] = true;
      console.warn('[flow3d] status "' + status + '" không có trong NODE_STATUS — '
        + 'status phải là token (' + Object.keys(NODE_STATUS).slice(0, 6).join(', ') + '…), không phải câu mô tả.');
    }
    return {html: '<span class="w">' + status + '</span>', col: window.SCENE_KIT.ink('mute'), title: status};
  }
  return {
    html: '<span class="g">' + s.g + '</span><span class="w">' + s.w + '</span>',
    col: window.SCENE_KIT.ink(s.ink),
    title: s.w
  };
}

/* Div phải ra đời trong lúc dựng world, không tạo lười lúc step đổi: label sinh
   ngoài giai đoạn build bị đánh dấu transient và sẽ bị clearTransientLabels()
   quét đi ở step kế tiếp — status thì phải sống hết kịch bản. Node chưa có
   status thì div nằm im (display:none) tới khi cần. */
function createNodeStatus(n, status) {
  n.statusDiv = addLabel('', n.x, n.baseY + n.h + NODE_STATUS_LIFT, n.z,
    'rgba(192,208,232,.75)', 0.3, false, 'node-status');
  n.statusObj = n.statusDiv._anchor;
  n.statusOff = [n.statusObj.position.x - n.g.position.x,
                 n.statusObj.position.y - n.g.position.y,
                 n.statusObj.position.z - n.g.position.z];
  setNodeStatus(n, status);
}

function setNodeStatus(n, status) {
  if (!n.statusDiv) return;
  if (!status) {
    n.statusDiv.classList.add('is-empty');
    n.status = '';
    return;
  }
  const view = nodeStatusHtml(status);
  n.statusDiv.classList.remove('is-empty');
  n.statusDiv.innerHTML = view.html;
  n.statusDiv.style.color = view.col;
  n.statusDiv.title = view.title;
  n.status = status;
}

/* Status bám theo box khi box di chuyển — cùng cách caption bám theo. */
function moveNodeStatus(n, x, y, z) {
  if (!n.statusObj || !n.statusOff) return;
  n.statusObj.position.set(x + n.statusOff[0], y + n.statusOff[1], z + n.statusOff[2]);
}
