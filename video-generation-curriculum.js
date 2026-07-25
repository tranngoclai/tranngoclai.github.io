/**
 * Video Generation Curriculum Contract
 * Single source of truth for the 41-lesson guided curriculum.
 */
(function () {
  'use strict';

  const manifest = [
    {
      id: 'overview',
      phase: 'Orientation',
      position: '0.1',
      title: 'Bản đồ Video Generation end-to-end',
      href: 'video-generation-part-0-lesson-1.html',
      legacyLabel: 'New',
      topic: 'Orientation',
      meta: 'Map',
      search: 'overview roadmap training generation end-to-end lộ trình toàn cảnh',
      kind: 'bridge',
      related: []
    },
    {
      id: 'diffusion',
      phase: 'Model Architecture',
      position: '1.1',
      title: 'Diffusion Model & Denoising',
      href: 'video-generation-part-1-lesson-1.html',
      legacyLabel: 'P1L1',
      topic: 'Model Architecture',
      meta: 'Core',
      search: 'diffusion model denoising noise forward reverse step',
      kind: 'legacy',
      related: []
    },
    {
      id: 'vae',
      phase: 'Model Architecture',
      position: '1.2',
      title: 'VAE & Latent Space',
      href: 'video-generation-part-1-lesson-2.html',
      legacyLabel: 'P1L2',
      topic: 'Model Architecture',
      meta: 'Compression',
      search: 'vae latent space encoder decoder spatial temporal compression',
      kind: 'legacy',
      related: []
    },
    {
      id: 'umt5',
      phase: 'Model Architecture',
      position: '1.3',
      title: 'UMT5/T5 Text Encoder',
      href: 'video-generation-part-1-lesson-4.html',
      legacyLabel: 'P1L4',
      topic: 'Model Architecture',
      meta: 'Text Conditioning',
      search: 'umt5 t5 text encoder long prompt complex instruction parsing t2v conditioning',
      kind: 'legacy',
      related: []
    },
    {
      id: 'clip',
      phase: 'Model Architecture',
      position: '1.4',
      title: 'CLIP Image Representation & Conditioning',
      href: 'video-generation-part-1-lesson-3.html',
      legacyLabel: 'P1L3',
      topic: 'Model Architecture',
      meta: 'Image Conditioning',
      search: 'clip vision image conditioning i2v embedding contrastive reference',
      kind: 'legacy',
      related: []
    },
    {
      id: 'backbone',
      phase: 'Model Architecture',
      position: '1.5',
      title: 'U-Net vs DiT Backbone',
      href: 'video-generation-part-1-lesson-5.html',
      legacyLabel: 'P1L6',
      topic: 'Model Architecture',
      meta: 'Architecture',
      search: 'unet dit backbone transformer diffusion scalable patch',
      kind: 'legacy',
      related: []
    },
    {
      id: 'attention',
      phase: 'Model Architecture',
      position: '1.6',
      title: 'Self & Cross-Attention',
      href: 'video-generation-part-1-lesson-6.html',
      legacyLabel: 'P1L5',
      topic: 'Model Architecture',
      meta: 'Attention',
      search: 'self attention cross attention query key value prompt injection',
      kind: 'legacy',
      related: []
    },
    {
      id: 'temporal-context',
      phase: 'Model Architecture',
      position: '1.7',
      title: 'Temporal Context Window',
      href: 'video-generation-part-1-lesson-7.html',
      legacyLabel: 'P2L5',
      topic: 'Model Architecture',
      meta: 'Sequence',
      search: 'temporal context window sequence length frame coherence motion consistency',
      kind: 'legacy',
      related: []
    },
    {
      id: 'training-brief',
      phase: 'Training Design',
      position: '2.1',
      title: 'Training Brief & Baseline',
      href: 'video-generation-part-2-lesson-1.html',
      legacyLabel: 'New',
      topic: 'Training',
      meta: 'Brief',
      search: 'training goal method baseline validation consent brief mục tiêu',
      kind: 'bridge',
      related: []
    },
    {
      id: 'dreambooth-trigger',
      phase: 'Training Design',
      position: '2.2',
      title: 'DreamBooth, Identifier & Trigger',
      href: 'video-generation-part-2-lesson-2.html',
      legacyLabel: 'P3L4',
      topic: 'Training',
      meta: 'Identity',
      search: 'dreambooth identifier trigger word concept preservation subject',
      kind: 'legacy',
      related: []
    },
    {
      id: 'lora',
      phase: 'Training Design',
      position: '2.3',
      title: 'LoRA Mechanics',
      href: 'video-generation-part-2-lesson-3.html',
      legacyLabel: 'P3L1',
      topic: 'Training',
      meta: 'Adapter',
      search: 'lora low rank adaptation rank alpha parameter efficient fine tuning',
      kind: 'legacy',
      related: []
    },
    {
      id: 'dataset-captioning',
      phase: 'Training Design',
      position: '2.4',
      title: 'Dataset & Captioning',
      href: 'video-generation-part-2-lesson-4.html',
      legacyLabel: 'P3L5',
      topic: 'Training',
      meta: 'Data',
      search: 'dataset captioning image pairing quality tagging synthetic prompt',
      kind: 'legacy',
      related: []
    },
    {
      id: 'rank-alpha',
      phase: 'Training Run',
      position: '3.1',
      title: 'Rank & Alpha',
      href: 'video-generation-part-3-lesson-1.html',
      legacyLabel: 'P3L2',
      topic: 'Training',
      meta: 'Hyperparameters',
      search: 'rank alpha lora ratio learning rate weight scaling parameter',
      kind: 'legacy',
      related: []
    },
    {
      id: 'wan-noise-stage',
      phase: 'Training Run',
      position: '3.2',
      title: 'Wan High/Low Noise Stage',
      href: 'video-generation-part-3-lesson-2.html',
      legacyLabel: 'P3L3',
      topic: 'Training',
      meta: 'Wan2.2',
      search: 'wan high low noise stage dual stage training simpletuner',
      kind: 'legacy',
      related: ['wan-nodes', 'first-t2v']
    },
    {
      id: 'train-run',
      phase: 'Training Run',
      position: '3.3',
      title: 'Configure & Run Training',
      href: 'video-generation-part-3-lesson-3.html',
      legacyLabel: 'P3L6',
      topic: 'Training',
      meta: 'Execution',
      search: 'configure run training command line options gpu vram batch size gradient',
      kind: 'legacy',
      related: []
    },
    {
      id: 'checkpoint-validation',
      phase: 'Training Run',
      position: '3.4',
      title: 'Validate, Select & Export Checkpoint',
      href: 'video-generation-part-3-lesson-4.html',
      legacyLabel: 'New',
      topic: 'Validation',
      meta: 'Workflow',
      search: 'checkpoint resume validation overfit collapse export lora',
      kind: 'bridge',
      related: []
    },
    {
      id: 'workflow-json',
      phase: 'Generation Setup',
      position: '4.1',
      title: 'Node & Workflow JSON',
      href: 'video-generation-part-4-lesson-1.html',
      legacyLabel: 'P6L1',
      topic: 'Generation',
      meta: 'ComfyUI',
      search: 'workflow json node graph serialization comfyui export import',
      kind: 'legacy',
      related: []
    },
    {
      id: 'custom-node-manager',
      phase: 'Generation Setup',
      position: '4.2',
      title: 'Custom Node & Manager',
      href: 'video-generation-part-4-lesson-2.html',
      legacyLabel: 'P6L2',
      topic: 'Generation',
      meta: 'Ecosystem',
      search: 'custom node comfyui manager extension installation git update',
      kind: 'legacy',
      related: []
    },
    {
      id: 'model-loaders',
      phase: 'Generation Setup',
      position: '4.3',
      title: 'Checkpoint & Model Loaders',
      href: 'video-generation-part-4-lesson-3.html',
      legacyLabel: 'P6L3',
      topic: 'Generation',
      meta: 'Loaders',
      search: 'checkpoint loader unet vae clip model loading diffusion pipeline',
      kind: 'legacy',
      related: []
    },
    {
      id: 'wan-nodes',
      phase: 'Generation Setup',
      position: '4.4',
      title: 'Bộ node WanVideo',
      href: 'video-generation-part-4-lesson-4.html',
      legacyLabel: 'P6L4',
      topic: 'Generation',
      meta: 'WanNodes',
      search: 'wanvideo nodes custom nodes wan wrapper high low stage loader',
      kind: 'legacy',
      related: []
    },
    {
      id: 'prompt-structure',
      phase: 'Generation Setup',
      position: '4.5',
      title: 'Cấu trúc Prompt cho Video',
      href: 'video-generation-part-4-lesson-7.html',
      legacyLabel: 'P7L3',
      topic: 'Generation',
      meta: 'Syntax',
      search: 'prompt structure video camera motion subject lighting scene syntax',
      kind: 'legacy',
      related: []
    },
    {
      id: 'positive-negative',
      phase: 'Generation Setup',
      position: '4.6',
      title: 'Positive & Negative Prompt',
      href: 'video-generation-part-4-lesson-5.html',
      legacyLabel: 'P7L1',
      topic: 'Generation',
      meta: 'Prompting',
      search: 'positive negative prompt conditioning text clip encode guidance',
      kind: 'legacy',
      related: []
    },
    {
      id: 'first-t2v',
      phase: 'Generation Setup',
      position: '4.7',
      title: 'First T2V: Base vs Exported LoRA',
      href: 'video-generation-part-4-lesson-6.html',
      legacyLabel: 'New',
      topic: 'Generation',
      meta: 'Lab',
      search: 'first t2v baseline base lora prompt seed workflow',
      kind: 'bridge',
      related: []
    },
    {
      id: 'prompt-weight-token',
      phase: 'Generation Setup',
      position: '4.8',
      title: 'Prompt Weighting & Token Context',
      href: 'video-generation-part-4-lesson-8.html',
      legacyLabel: 'P7L2',
      topic: 'Generation',
      meta: 'Weighting',
      search: 'prompt weighting token context emphasis word weight chunking',
      kind: 'legacy',
      related: []
    },
    {
      id: 'generation-mode',
      phase: 'Conditioning',
      position: '5.1',
      title: 'Chọn T2V, I2V hay FLF2V',
      href: 'video-generation-part-5-lesson-1.html',
      legacyLabel: 'P4L1',
      topic: 'Conditioning',
      meta: 'Mode',
      search: 't2v i2v flf2v text to video image to video first last frame',
      kind: 'legacy',
      related: []
    },
    {
      id: 'frames-resolution-fps',
      phase: 'Conditioning',
      position: '5.2',
      title: 'FPS, Frames & Resolution',
      href: 'video-generation-part-5-lesson-2.html',
      legacyLabel: 'P5L1',
      topic: 'Conditioning',
      meta: 'Params',
      search: 'fps frames resolution aspect ratio duration motion smoothness',
      kind: 'legacy',
      related: []
    },
    {
      id: 'clip-vision',
      phase: 'Conditioning',
      position: '5.3',
      title: 'CLIP Vision Encode',
      href: 'video-generation-part-5-lesson-3.html',
      legacyLabel: 'P4L2',
      topic: 'Conditioning',
      meta: 'Vision',
      search: 'clip vision encode image conditioning image feature embedding',
      kind: 'legacy',
      related: []
    },
    {
      id: 'ip-adapter',
      phase: 'Conditioning',
      position: '5.4',
      title: 'IP-Adapter',
      href: 'video-generation-part-5-lesson-4.html',
      legacyLabel: 'P4L3',
      topic: 'Conditioning',
      meta: 'Style/Image',
      search: 'ip-adapter image prompt adapter cross attention visual prompt',
      kind: 'legacy',
      related: []
    },
    {
      id: 'faceid',
      phase: 'Conditioning',
      position: '5.5',
      title: 'FaceID',
      href: 'video-generation-part-5-lesson-5.html',
      legacyLabel: 'P4L4',
      topic: 'Conditioning',
      meta: 'Face',
      search: 'faceid facial identity embedding insightface portrait preservation',
      kind: 'legacy',
      related: []
    },
    {
      id: 'instantid',
      phase: 'Conditioning',
      position: '5.6',
      title: 'InstantID',
      href: 'video-generation-part-5-lesson-6.html',
      legacyLabel: 'P5L5',
      topic: 'Conditioning',
      meta: 'InstantID',
      search: 'instantid zero-shot identity keypoint controlnet face generation',
      kind: 'legacy',
      related: []
    },
    {
      id: 'controlnet',
      phase: 'Conditioning',
      position: '5.7',
      title: 'ControlNet',
      href: 'video-generation-part-5-lesson-7.html',
      legacyLabel: 'P4L6',
      topic: 'Conditioning',
      meta: 'Control',
      search: 'controlnet depth openpose lineart hed scribble spatial guidance',
      kind: 'legacy',
      related: []
    },
    {
      id: 'latent-noise-aug',
      phase: 'Conditioning',
      position: '5.8',
      title: 'Latent Strength & Noise Aug',
      href: 'video-generation-part-5-lesson-8.html',
      legacyLabel: 'P4L7',
      topic: 'Conditioning',
      meta: 'NoiseAug',
      search: 'latent strength noise augmentation i2v denoise strength variation',
      kind: 'legacy',
      related: []
    },
    {
      id: 'timestep-sigma',
      phase: 'Sampling',
      position: '6.1',
      title: 'Timestep & Sigma',
      href: 'video-generation-part-6-lesson-1.html',
      legacyLabel: 'P2L1',
      topic: 'Sampling',
      meta: 'Schedule',
      search: 'timestep sigma noise schedule euler karras exponential uniform',
      kind: 'legacy',
      related: []
    },
    {
      id: 'scheduler',
      phase: 'Sampling',
      position: '6.2',
      title: 'Scheduler',
      href: 'video-generation-part-6-lesson-2.html',
      legacyLabel: 'P2L2',
      topic: 'Sampling',
      meta: 'Scheduler',
      search: 'scheduler noise discretization euler ancestral dpm++ ddim',
      kind: 'legacy',
      related: []
    },
    {
      id: 'sampler',
      phase: 'Sampling',
      position: '6.3',
      title: 'Sampler & Denoising Steps',
      href: 'video-generation-part-6-lesson-3.html',
      legacyLabel: 'P2L3',
      topic: 'Sampling',
      meta: 'Sampler',
      search: 'sampler denoising steps ksampler iteration step count convergence',
      kind: 'legacy',
      related: []
    },
    {
      id: 'cfg',
      phase: 'Sampling',
      position: '6.4',
      title: 'CFG & Guidance',
      href: 'video-generation-part-6-lesson-4.html',
      legacyLabel: 'P2L4',
      topic: 'Sampling',
      meta: 'Guidance',
      search: 'cfg classifier free guidance scale prompt adherence saturation',
      kind: 'legacy',
      related: []
    },
    {
      id: 'vram-block-swap',
      phase: 'Sampling',
      position: '6.5',
      title: 'VRAM Optimization & Block Swap',
      href: 'video-generation-part-6-lesson-5.html',
      legacyLabel: 'P2L6',
      topic: 'Sampling',
      meta: 'Optimization',
      search: 'vram optimization block swap offload cpu ram attention flash',
      kind: 'legacy',
      related: ['latent-noise-aug']
    },
    {
      id: 'frame-codec',
      phase: 'Output & Operations',
      position: '7.1',
      title: 'Ghép Frame, Codec & Container',
      href: 'video-generation-part-7-lesson-1.html',
      legacyLabel: 'P5L2',
      topic: 'Operations',
      meta: 'Export',
      search: 'frame codec container mp4 h264 ffmpeg video assembly',
      kind: 'legacy',
      related: []
    },
    {
      id: 'temporal-quality',
      phase: 'Output & Operations',
      position: '7.2',
      title: 'Chất lượng chuyển động',
      href: 'video-generation-part-7-lesson-2.html',
      legacyLabel: 'P5L3',
      topic: 'Operations',
      meta: 'Quality',
      search: 'temporal quality motion flickering artifacts smooth interpolation',
      kind: 'legacy',
      related: []
    },
    {
      id: 'experiment-loop',
      phase: 'Output & Operations',
      position: '7.3',
      title: 'Experiment Loop & Reproducibility',
      href: 'video-generation-part-7-lesson-3.html',
      legacyLabel: 'New',
      topic: 'Evaluation',
      meta: 'Workflow',
      search: 'experiment ab compare reproducibility run log accept reject',
      kind: 'bridge',
      related: []
    },
    {
      id: 'runpod-operations',
      phase: 'Output & Operations',
      position: '7.4',
      title: 'Tùy chọn: Chạy Workflow trên RunPod',
      href: 'video-generation-part-7-lesson-4.html',
      legacyLabel: 'P6L5',
      topic: 'Operations',
      meta: 'Cloud',
      search: 'runpod operations cloud gpu instance deployment pod volume SSH',
      kind: 'legacy',
      related: []
    }
  ];

  function deepFreeze(obj) {
    Object.freeze(obj);
    Object.keys(obj).forEach(function (prop) {
      if (
        obj[prop] !== null &&
        (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
        !Object.isFrozen(obj[prop])
      ) {
        deepFreeze(obj[prop]);
      }
    });
    return obj;
  }

  const frozenCurriculum = deepFreeze(manifest);

  const contract = {
    schemaVersion: '1',
    contentVersion: '2026-07-26.2',
    items: frozenCurriculum
  };

  deepFreeze(contract);

  if (typeof globalThis !== 'undefined') {
    globalThis.VIDEO_GENERATION_CURRICULUM = contract.items;
    globalThis.VIDEO_GENERATION_CURRICULUM_CONTRACT = contract;
  }
})();
