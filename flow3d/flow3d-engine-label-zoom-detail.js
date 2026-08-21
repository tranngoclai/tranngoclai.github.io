/* ─ Label detail theo mức zoom ─
   Một caption mang hai loại chữ khác hẳn nhau: **tên** (Worker A, kube-proxy)
   và **chi tiết** (cpu 4/16, nodeName: "worker-a", từ mô tả status). Ở shot
   rộng — cả cluster trong khung — chi tiết là nhiễu: mắt cần đọc ra hình dạng
   của cụm chứ không phải mười lăm con số bé xíu chồng lên nhau. Zoom vào một
   component thì ngược lại, con số mới là thứ cần đọc.

   Nên chi tiết chỉ hiện khi camera đủ gần. Cắt bằng CSS chứ không xoá chữ:
   cùng một DOM, chỉ đổi một class trên #labels, nên không có gì phải dựng lại
   khi camera lùi ra rồi tiến vào.

       xa:  Worker A          ▶
       gần: Worker A          ▶ RUNNING
            cpu 4/16
*/

/* Ngưỡng đặt giữa hai loại shot mà deck thật sự dùng: frameFocus() kẹp camera
   trong 24…58, shot rộng của một world thường 46+, shot một component 24–30.
   Dải trễ (hysteresis) để camera dừng quanh ngưỡng không làm chữ nhấp nháy. */
const LABEL_DETAIL_NEAR = 34;
const LABEL_DETAIL_FAR = 39;
let labelDetailOn = true;

/* Tách caption thành tên + chi tiết. Dòng đầu là tên — đó đã là quy ước của
   kit (rule 3: 'Worker A\ncpu 4/16'), nên không cần tác giả khai gì thêm. */
function captionHtml(text) {
  const raw = text === undefined || text === null ? '' : String(text);
  const cut = raw.indexOf('\n');
  if (cut < 0) return raw;
  return raw.slice(0, cut) + '<span class="detail">' + raw.slice(cut) + '</span>';
}

function updateLabelDetail(camera, controls) {
  const dist = camera.position.distanceTo(controls.target);
  if (labelDetailOn && dist > LABEL_DETAIL_FAR) labelDetailOn = false;
  else if (!labelDetailOn && dist < LABEL_DETAIL_NEAR) labelDetailOn = true;
  labelsDiv.classList.toggle('lod-far', !labelDetailOn);
}
