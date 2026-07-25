# Video Generation — Danh sách & Lộ trình Bài học (Canonical Curriculum)

Tài liệu quy chuẩn cho chuỗi 41 bài học đào tạo kỹ sư tạo sinh video end-to-end (Video Generation Engine & Wan2.2 Pipeline). Chương trình được định hình theo luồng làm việc thực tế của AI video engineer: **Kiến trúc Model dùng chung → Huấn luyện LoRA (Training Design & Run) → Setup ComfyUI Pipeline → Điều kiện hóa & Sampling → Vận hành & Xuất bản (Output & Operations)**.

> [!NOTE]
> **Migration & Architectural Notice:** Các tệp tin legacy vật lý (`video-generation-part-X-lesson-Y.html`) được bảo toàn tuyệt đối để giữ đường dây phân kỳ git, bookmark của người học và thứ hạng SEO, trong khi nhãn hiển thị (Phase & Lesson position) phản ánh trật tự tư duy thực tế tối ưu hơn: đặt huấn luyện model lên trước bước tạo sinh diện rộng.

---

## Phase 0 — Orientation (Định hướng & Bản đồ toàn cảnh)

| Vị trí | ID | Tên bài học | Tệp tin vật lý | Legacy Label | Artifact Đầu ra & Handoff |
|:---:|---|---|---|:---:|---|
| **0.1** | `overview` | Bản đồ Video Generation end-to-end | `video-generation-part-0-lesson-1.html` | **New** | **End-to-End Execution Map** → Handoff: Thiết lập tư duy lý thuyết diffusion cơ bản. |

---

## Phase 1 — Model Architecture (Kiến trúc Model — trước Train & Inference)

> [!IMPORTANT]
> Đây là pha giải thích các khối dùng chung, không phải hướng dẫn thực hành train hoặc inference. Mỗi bài nêu rõ ba góc nhìn: base-model pretraining để hiểu checkpoint, LoRA training ở Phase 2–3, và inference ở Phase 4–7.

| Vị trí | ID | Tên bài học | Tệp tin vật lý | Legacy Label | Artifact Đầu ra & Handoff |
|:---:|---|---|---|:---:|---|
| **1.1** | `diffusion` | Diffusion Model & Denoising | `video-generation-part-1-lesson-1.html` | P1L1 | **Denoising Map** → Phân biệt base pretraining, LoRA training và inference trước khi đi vào latent. |
| **1.2** | `vae` | VAE & Latent Space | `video-generation-part-1-lesson-2.html` | P1L2 | **Latent I/O Map** → Nối pixel/latent với đường prompt T2V. |
| **1.3** | `umt5` | UMT5/T5 Text Encoder | `video-generation-part-1-lesson-4.html` | P1L4 | **Text Conditioning Map** → Đường prompt chính cho T2V, trước khi mở nhánh ảnh tham chiếu. |
| **1.4** | `clip` | CLIP Image Representation & Conditioning | `video-generation-part-1-lesson-3.html` | P1L3 | **Image Conditioning Map** → Đường ảnh tham chiếu I2V dẫn vào backbone. |
| **1.5** | `backbone` | U-Net vs DiT Backbone | `video-generation-part-1-lesson-5.html` | P1L6 | **Denoiser & Adapter Map** → Phân biệt nơi LoRA tác động với nơi denoising chạy. |
| **1.6** | `attention` | Self & Cross-Attention | `video-generation-part-1-lesson-6.html` | P1L5 | **Conditioning Injection Map** → Nối text/image embedding với latent tokens. |
| **1.7** | `temporal-context` | Temporal Context Window | `video-generation-part-1-lesson-7.html` | P2L5 | **Temporal Constraint Map** → Chuyển sang ràng buộc dữ liệu/train và window/overlap inference. |

---

## Phase 2 — Training Design (Thiết kế Kế hoạch & Dữ liệu Huấn luyện)

| Vị trí | ID | Tên bài học | Tệp tin vật lý | Legacy Label | Artifact Đầu ra & Handoff |
|:---:|---|---|---|:---:|---|
| **2.1** | `training-brief` | Training Brief & Baseline | `video-generation-part-2-lesson-1.html` | **New** | **LoRA Training Architecture Brief** → Handoff: Xác định quy ước định danh Concept Identifier. |
| **2.2** | `dreambooth-trigger` | DreamBooth, Identifier & Trigger | `video-generation-part-2-lesson-2.html` | P3L4 | **Concept Identifier Matrix** → Handoff: Chuyển đặc tả identifier vào cơ cấu ma trận trọng số LoRA. |
| **2.3** | `lora` | LoRA Mechanics | `video-generation-part-2-lesson-3.html` | P3L1 | **Low-Rank Matrix Specification** → Handoff: Chuẩn bị dataset khớp với đặc tính kích thước và rank. |
| **2.4** | `dataset-captioning` | Dataset & Captioning | `video-generation-part-2-lesson-4.html` | P3L5 | **Dataset Curate & Caption Manifest** → Handoff: Giao dataset sạch sang pha cấu hình siêu tham số và chạy train. |

---

## Phase 3 — Training Run (Cấu hình & Tiến hành Huấn luyện)

| Vị trí | ID | Tên bài học | Tệp tin vật lý | Legacy Label | Artifact Đầu ra & Handoff |
|:---:|---|---|---|:---:|---|
| **3.1** | `rank-alpha` | Rank & Alpha | `video-generation-part-3-lesson-1.html` | P3L2 | **Capacity & Alpha Tuner Spec** → Handoff: Xác định giai đoạn tác động theo dải nhiễu high/low noise. |
| **3.2** | `wan-noise-stage` | Wan High/Low Noise Stage | `video-generation-part-3-lesson-2.html` | P3L3 | **Noise Stage Mask Allocation** → Handoff: Nhập tham số vào file script khởi chạy huấn luyện thực tế. |
| **3.3** | `train-run` | Configure & Run Training | `video-generation-part-3-lesson-3.html` | P3L6 | **Trainer Execution Command Set** → Handoff: Đưa trọng số thu được sang bộ kiểm tra chất lượng nghiệm thu. |
| **3.4** | `checkpoint-validation` | Validate, Select & Export Checkpoint | `video-generation-part-3-lesson-4.html` | **New** | **Validated LoRA Safetensors Package** → Handoff: Triển khai checkpoint đã verify vào pipeline ComfyUI tạo sinh. |

---

## Phase 4 — Generation Setup (Thiết lập Pipeline ComfyUI & Cấu trúc Prompt)

| Vị trí | ID | Tên bài học | Tệp tin vật lý | Legacy Label | Artifact Đầu ra & Handoff |
|:---:|---|---|---|:---:|---|
| **4.1** | `workflow-json` | Node & Workflow JSON | `video-generation-part-4-lesson-1.html` | P6L1 | **ComfyUI API Execution Graph** → Handoff: Tích hợp hệ sinh thái quản lý node mở rộng. |
| **4.2** | `custom-node-manager` | Custom Node & Manager | `video-generation-part-4-lesson-2.html` | P6L2 | **Verified Environment Registry** → Handoff: Nạp hệ thống checkpoint, VAE và adapter hợp lệ vào bộ nhớ. |
| **4.3** | `model-loaders` | Checkpoint & Model Loaders | `video-generation-part-4-lesson-3.html` | P6L3 | **Model Memory Allocation Table** → Handoff: Chuyển quyền xử lý sang cụm chuyên gia WanVideo. |
| **4.4** | `wan-nodes` | Bộ node WanVideo | `video-generation-part-4-lesson-4.html` | P6L4 | **Wan2.1 Sampler Pipeline Config** → Handoff: Chuẩn bị cấu trúc prompt và điều hướng đầu vào. |
| **4.5** | `prompt-structure` | Cấu trúc Prompt cho Video | `video-generation-part-4-lesson-7.html` | P7L3 | **Structured Cinematographic Prompt Schema** → Handoff: Tách prompt thành positive/negative trước khi chạy baseline. |
| **4.6** | `positive-negative` | Positive & Negative Prompt | `video-generation-part-4-lesson-5.html` | P7L1 | **Quality Control Token Vocabulary** → Handoff: Chuẩn bị prompt hoàn chỉnh cho baseline T2V tiêu chuẩn. |
| **4.7** | `first-t2v` | First T2V: Base vs Exported LoRA | `video-generation-part-4-lesson-6.html` | **New** | **T2V Inference Benchmark Sheet** → Handoff: Dùng preset cung cấp sẵn; sang bài sau để tinh chỉnh trọng số và giới hạn token. |
| **4.8** | `prompt-weight-token` | Prompt Weighting & Token Context | `video-generation-part-4-lesson-8.html` | P7L2 | **Weighted Attention Prompt Profile** → Handoff: Chuyển sang chọn chế độ tạo sinh và kỹ thuật điều kiện hóa hình ảnh. |

---

## Phase 5 — Conditioning (Chọn nhánh điều kiện hóa theo mục tiêu)

> [!TIP]
> Hoàn tất **5.1** và **5.2**, rồi chọn nhánh phục vụ shot của bạn. Đây không phải tám bài bắt buộc theo một đường thẳng: **T2V** có thể đi thẳng tới Phase 6 — Sampling; **I2V / ảnh tham chiếu** đi qua CLIP Vision và IP-Adapter; **giữ danh tính** chọn FaceID hoặc InstantID; **khóa bố cục/chuyển động** dùng ControlNet rồi Latent Strength & Noise Aug. Có thể quay lại học thêm nhánh khi brief thay đổi.

| Vị trí | ID | Tên bài học | Tệp tin vật lý | Legacy Label | Artifact Đầu ra & Handoff |
|:---:|---|---|---|:---:|---|
| **5.1** | `generation-mode` | Chọn T2V, I2V hay FLF2V | `video-generation-part-5-lesson-1.html` | P4L1 | **Generation Mode Decision Graph** → Handoff: Thiết lập kích thước khung hình, thời lượng và tốc độ FPS. |
| **5.2** | `frames-resolution-fps` | FPS, Frames & Resolution | `video-generation-part-5-lesson-2.html` | P5L1 | **Resolution & FPS Budget Grid** → Handoff: chọn một nhánh theo brief, hoặc đi thẳng Sampling nếu là T2V. |
| **5.3** | `clip-vision` | CLIP Vision Encode | `video-generation-part-5-lesson-3.html` | P4L2 | **I2V / Reference Entry** → Handoff: truyền embedding qua IP-Adapter khi cần giữ style, nhân vật hoặc bố cục ảnh. |
| **5.4** | `ip-adapter` | IP-Adapter | `video-generation-part-5-lesson-4.html` | P4L3 | **Reference Conditioning Schema** → Handoff: sang Sampling, hoặc thêm nhánh identity / structural control nếu brief yêu cầu. |
| **5.5** | `faceid` | FaceID | `video-generation-part-5-lesson-5.html` | P4L4 | **Identity Embedding Integration Map** → Handoff: một lựa chọn giữ danh tính; chọn InstantID khi workflow zero-shot phù hợp hơn. |
| **5.6** | `instantid` | InstantID | `video-generation-part-5-lesson-6.html` | P4L5 | **Zero-Shot Identity Lock Matrix** → Handoff: một lựa chọn identity khác; sang Sampling hoặc kết hợp control khi cần. |
| **5.7** | `controlnet` | ControlNet | `video-generation-part-5-lesson-7.html` | P4L6 | **Structural Guidance Map Config** → Handoff: tinh chỉnh Latent Strength & Noise Aug cho I2V/FLF2V. |
| **5.8** | `latent-noise-aug` | Latent Strength & Noise Aug | `video-generation-part-5-lesson-8.html` | P4L7 | **Latent Conditioning Balance Sheet** → Handoff: sang cụm Sampling & Inference. |

---

## Phase 6 — Sampling (Tối ưu Thuật toán Khử nhiễu & Bộ nhớ)

| Vị trí | ID | Tên bài học | Tệp tin vật lý | Legacy Label | Artifact Đầu ra & Handoff |
|:---:|---|---|---|:---:|---|
| **6.1** | `timestep-sigma` | Timestep & Sigma | `video-generation-part-6-lesson-1.html` | P2L1 | **Sigma Distribution Curve Matrix** → Handoff: Chọn lịch trình suy giảm noise (scheduler) tương ứng. |
| **6.2** | `scheduler` | Scheduler | `video-generation-part-6-lesson-2.html` | P2L2 | **Scheduler Velocity Progression Plan** → Handoff: Lắp bộ thuật toán giải phẫu bước nhảy (sampler). |
| **6.3** | `sampler` | Sampler & Denoising Steps | `video-generation-part-6-lesson-3.html` | P2L3 | **Denoising Convergence Blueprint** → Handoff: Cân bằng CFG Guidance Scale tránh hao mòn chất lượng frame. |
| **6.4** | `cfg` | CFG & Guidance | `video-generation-part-6-lesson-4.html` | P2L4 | **CFG Guidance Dynamic Matrix** → Handoff: Tối ưu mức tiêu thụ VRAM bằng kỹ thuật Block Swap qua RAM. |
| **6.5** | `vram-block-swap` | VRAM Optimization & Block Swap | `video-generation-part-6-lesson-5.html` | P2L6 | **VRAM Block-Swap Optimization Profile** → Handoff: Chuyển dữ liệu latent đã khử nhiễu hoàn tất sang giai đoạn decode và xuất vio clip. |

---

## Phase 7 — Output & Operations (Xuất Video, Đánh giá & Triển khai Cloud)

| Vị trí | ID | Tên bài học | Tệp tin vật lý | Legacy Label | Artifact Đầu ra & Handoff |
|:---:|---|---|---|:---:|---|
| **7.1** | `frame-codec` | Ghép Frame, Codec & Container | `video-generation-part-7-lesson-1.html` | P5L2 | **Container Codec Render Profile** → Handoff: Đưa vio clip vào hệ kiểm thử chất lượng mượt mà và chuyển động. |
| **7.2** | `temporal-quality` | Chất lượng chuyển động | `video-generation-part-7-lesson-2.html` | P5L3 | **Temporal Consistency Quality Scorecard** → Handoff: Triển khai các chuỗi thử nghiệm A/B tinh chỉnh thông số hiệu quả. |
| **7.3** | `experiment-loop` | Experiment Loop & Reproducibility | `video-generation-part-7-lesson-3.html` | **New** | **A/B Experiment Log & Reproducibility Matrix** → **[Hoàn tất journey cốt lõi: train, tạo sinh, đánh giá và xuất video]**. |
| **7.4** | `runpod-operations` | Tùy chọn: Chạy Workflow trên RunPod | `video-generation-part-7-lesson-4.html` | P6L5 | **RunPod Cloud Deployment Blueprint** → Nhánh vận hành khi cần GPU cloud, volume hoặc triển khai workflow từ xa. |

---

## Phương pháp Nghiệm thu & Thực hành (Standard Practice Loop)

1. **Chuẩn kiến thức học theo Cụm (Phase By Phase):** Bắt đầu vững chắc từ Phase 0 & 1 trước khi tiến hành thu thập dữ liệu và tự thao tác huấn luyện mô hình ở Phase 2 & 3.
2. **Kế thừa Artifacts (Output to Input Continuity):** Mỗi bài học khép lại bằng một **Artifact Đầu ra**, đóng vai trò là tài liệu đặc tả hoặc tham số đầu vào cho **Bài tiếp theo**. Khuyến nghị người học giữ trọn hồ sơ artifact qua các phase.
3. **Thao tác nhanh trên Trang Chủ:** Mọi hàng bài học tại `index.html` đều hỗ trợ phím tắt `/` để tìm kiếm tức thời, cho phép tra cứu ngay các topic kỹ thuật, node ComfyUI, hay tên bài theo đúng mã ID và từ khóa liên quan.
