# Video Generation — Danh sách bài học

Lộ trình bài học sinh lại từ đầu dựa trên keyword trong `video-generation-study-glossary.md`.
Tổ chức theo thứ tự học từ nền tảng → nâng cao, mỗi bài gom các keyword liên quan.

---

## Part 1 — Kiến trúc Model (nền tảng)

| # | Tên bài | Keyword bao phủ |
|---|---|---|
| 1 | Diffusion Model & Denoising | Diffusion Model, Denoising Diffusion, Latent Space |
| 2 | VAE — Nén ảnh/video sang latent | VAE, Latent Space |
| 3 | CLIP — Liên kết ảnh và ngôn ngữ | CLIP |
| 4 | Text Encoder UMT5/T5 | UMT5/T5 Text Encoder |
| 5 | Attention — Self & Cross | Self-Attention, Cross-Attention |
| 6 | U-Net vs DiT — Hai loại backbone | U-Net, DiT, Transformer Block |

**Mục tiêu:** hiểu diffusion sinh ảnh thế nào, latent space là gì, text điều kiện hóa ra sao, và backbone khử nhiễu hoạt động thế nào.

---

## Part 2 — Sampling / Inference

| # | Tên bài | Keyword bao phủ |
|---|---|---|
| 1 | Timestep & Sigma — Trục thời gian của diffusion | Timestep, Sigma |
| 2 | Scheduler — Lịch trình noise | Scheduler |
| 3 | Sampler — Thuật toán khử nhiễu | Sampler, Denoising Steps |
| 4 | CFG — Điều khiển độ bám prompt | CFG Scale, CFG Schedule |
| 5 | Context Window — Attention theo thời gian | Context Window |
| 6 | Tối ưu VRAM & Noise Aug | Block Swap, Noise Augmentation |

**Mục tiêu:** biết chỉnh tham số inference để cân bằng chất lượng / tốc độ / VRAM.

---

## Part 3 — LoRA / Fine-tuning

| # | Tên bài | Keyword bao phủ |
|---|---|---|
| 1 | LoRA là gì — Low-Rank Adaptation | LoRA, LoRA Strength/Weight |
| 2 | Rank & Alpha — Capacity của LoRA | Rank (network_dim), Alpha (network_alpha) |
| 3 | High Noise vs Low Noise LoRA | High Noise LoRA, Low Noise LoRA |
| 4 | DreamBooth & Trigger Word | DreamBooth, Trigger Word |
| 5 | Chuẩn bị dataset & captioning | Dataset Captioning, Overfitting |
| 6 | Train với kohya_ss / SimpleTuner | kohya_ss, SimpleTuner, Learning Rate, Training Steps |

**Mục tiêu:** train được một face LoRA từ đầu và biết chỉnh siêu tham số.

---

## Part 4 — Image/Video Conditioning

| # | Tên bài | Keyword bao phủ |
|---|---|---|
| 1 | I2V, T2V, FLF2V — Các chế độ sinh video | I2V, T2V, FLF2V |
| 2 | CLIP Vision Encode — Điều kiện hóa bằng ảnh | CLIP Vision Encode, Reference Image |
| 3 | IP-Adapter — Inject image embedding | IP-Adapter |
| 4 | FaceID — Giữ khuôn mặt nhất quán | IP-Adapter FaceID, InsightFace, ArcFace |
| 5 | InstantID — Face conditioning mạnh | InstantID |
| 6 | ControlNet — Điều kiện cấu trúc | ControlNet |
| 7 | Latent Strength & Noise Aug trong I2V/FLF2V | Noise Aug Strength, Start Latent Strength, End Latent Strength |

**Mục tiêu:** điều khiển nội dung/khuôn mặt/cấu trúc của video output.

---

## Part 5 — Video Output

| # | Tên bài | Keyword bao phủ |
|---|---|---|
| 1 | FPS, Frames & Resolution | FPS, Number of Frames, Resolution |
| 2 | Ghép frame & Codec | VHS_VideoCombine, H.264/H.265 |
| 3 | Chất lượng chuyển động | Temporal Consistency, Motion Score |

**Mục tiêu:** hiểu tham số output ảnh hưởng VRAM và chất lượng video cuối.

---

## Part 6 — ComfyUI / Workflow

| # | Tên bài | Keyword bao phủ |
|---|---|---|
| 1 | Node & Workflow JSON | Node, Workflow JSON, API Format |
| 2 | Custom Node & Manager | Custom Node, ComfyUI Manager |
| 3 | Checkpoint & Model loaders | Checkpoint |
| 4 | Bộ node WanVideo | WanVideoSampler, WanVideoVAELoader, WanVideoClipVisionEncode, WanVideoLoraSelectMulti |
| 5 | Chạy trên RunPod | Network Volume |

**Mục tiêu:** dựng và chạy được pipeline Wan2.2 trong ComfyUI, kể cả trên cloud.

---

## Part 7 — Prompt Engineering

| # | Tên bài | Keyword bao phủ |
|---|---|---|
| 1 | Positive & Negative Prompt | Positive Prompt, Negative Prompt |
| 2 | Prompt Weighting & Token Limit | Prompt Weighting, Token Limit |
| 3 | Cấu trúc prompt cho video | Subject Description, Motion Description, Style Keywords |

**Mục tiêu:** viết prompt hiệu quả cho subject, motion và style.

---

## Lộ trình đề xuất

```
Tuần 1: Part 1 (kiến trúc) → Part 2 (sampling)
Tuần 2: Part 6 (ComfyUI) → Part 4 (I2V conditioning) → Part 7 (prompt)
Tuần 3: Part 3 (LoRA concept → train face LoRA)
Tuần 4: Part 4 nâng cao (FaceID/InstantID) → Part 5 (output & temporal consistency)
```
