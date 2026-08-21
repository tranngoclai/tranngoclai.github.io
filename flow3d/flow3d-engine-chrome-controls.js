/* ══════════════════════════════════════════════
   ENGINE — CHROME CONTROLS (chú giải màu · chất lượng hiệu ứng)

   Kit tự nhận "người xem học ngôn ngữ màu trong phút đầu" — nhưng trước file
   này UI không hề có bảng chú giải, nên ngôn ngữ đó phải đoán. Một nút `?` mở
   popover liệt kê đúng các token TONE, tô bằng chính màu `edge` mà cảnh đang
   dùng: chú giải không thể lệch với cảnh vì nó đọc thẳng từ token.

   Cạnh đó là nút chất lượng hiệu ứng (bloom bật/tắt) — bắt buộc phải lộ ra,
   vì máy yếu bị mặc định xuống THẤP thì người dùng máy khoẻ cần đường quay lại.

   DOM dựng bằng JS thay vì viết vào từng file .html deck: ba deck dùng chung
   một shell, thêm tay là ba lần sửa và ba cơ hội lệch nhau.
══════════════════════════════════════════════ */

(function() {
const panel = document.getElementById('flow-panel');
if (!panel) return;

const TONE = window.SCENE_KIT.TONE;

/* Chỉ những token thực sự mang nghĩa cho người xem. `peer`, `surface`,
   `system`, `engine` là bối cảnh — liệt kê ra chỉ làm dài bảng. */
const LEGEND = [
  ['subject', 'Nhân vật chính — thứ kịch bản đang bám theo'],
  ['core',    'Trung tâm mọi thứ nói chuyện với nó'],
  ['gate',    'Chốt chặn phải đi qua'],
  ['store',   'Nơi ghi xuống, lưu lại'],
  ['queue',   'Hàng đợi — đang chờ tới lượt'],
  ['live',    'Đang chạy, khoẻ'],
  ['warn',    'Tạm thời, đã giữ chỗ'],
  ['danger',  'Trượt một phép kiểm tra'],
  ['doomed',  'Bị đánh dấu để xoá'],
  ['crown',   'Người thắng của bước này']
];

const bar = document.createElement('div');
bar.id = 'panel-tools';

const legendBtn = document.createElement('button');
legendBtn.type = 'button';
legendBtn.id = 'legend-toggle';
legendBtn.setAttribute('aria-expanded', 'false');
legendBtn.setAttribute('aria-controls', 'legend-popover');
legendBtn.title = 'Chú giải màu';
legendBtn.textContent = '? Chú giải';

const qualityBtn = document.createElement('button');
qualityBtn.type = 'button';
qualityBtn.id = 'quality-toggle';

const pop = document.createElement('div');
pop.id = 'legend-popover';
pop.hidden = true;
LEGEND.forEach(function(row) {
  const tone = TONE[row[0]];
  if (!tone) return;
  const line = document.createElement('div');
  line.className = 'legend-row';
  const sw = document.createElement('span');
  sw.className = 'legend-swatch';
  sw.style.background = tone.col;
  sw.style.borderColor = tone.edge;
  sw.style.boxShadow = '0 0 7px ' + tone.edge;
  const name = document.createElement('span');
  name.className = 'legend-name';
  name.textContent = row[0];
  const desc = document.createElement('span');
  desc.className = 'legend-desc';
  desc.textContent = row[1];
  line.append(sw, name, desc);
  pop.appendChild(line);
});

bar.append(legendBtn, qualityBtn);
panel.append(bar, pop);

function setLegendOpen(open) {
  pop.hidden = !open;
  legendBtn.setAttribute('aria-expanded', String(open));
}
legendBtn.addEventListener('click', function() { setLegendOpen(pop.hidden); });
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !pop.hidden) setLegendOpen(false);
});

/* ── Chất lượng hiệu ứng ── */
const render = window.FLOW3D && window.FLOW3D.render;
function paintQuality() {
  const q = render ? render.get() : 'low';
  qualityBtn.textContent = 'Hiệu ứng: ' + (q === 'high' ? 'Cao' : 'Thấp');
  qualityBtn.setAttribute('aria-pressed', String(q === 'high'));
}
if (!render || !render.available) {
  qualityBtn.disabled = true;
  qualityBtn.title = 'Máy/trình duyệt này không dựng được hiệu ứng nở sáng';
} else {
  qualityBtn.title = 'Bật/tắt nở sáng (bloom) — tắt nếu cảnh giật';
  qualityBtn.addEventListener('click', function() {
    render.set(render.get() === 'high' ? 'low' : 'high');
    paintQuality();
  });
}
paintQuality();
})();
