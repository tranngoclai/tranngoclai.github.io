/* ══════════════════════════════════════════════
   EVOLUTION — MODEL (core + Stage 0)

   Nguồn DUY NHẤT của mọi domain value hiển thị trong label, panel và HUD.
   Không Three.js, không DOM — chạy được bằng `node` để assert regression.

   ── Vì sao `architecture` là object chứ không phải một generation ID ──
   Media, interaction, financial và fleet policy tiến hóa ĐỘC LẬP và cộng dồn.
   Một scalar "generation 3" sẽ ngầm nói interaction đã tiến hóa cùng nhịp với
   media — đúng cái hiểu sai mà deck tồn tại để phá.

   ── Vì sao Stage 0 không có plane nào `pass` ──
   `pass` là kết quả của một phép thử. Stage 0 chỉ chạy happy path, không vặn
   núm áp lực nào, nên cả bốn plane giữ `untested`. Verdict đầu tiên của deck
   xuất hiện ở Phase 1A.

   Mọi con số capacity/bitrate/price ở đây là PLANNING ASSUMPTION có provenance
   record, không phải production fact.
══════════════════════════════════════════════ */

(function() {

const DEFAULT_CONFIG = Object.freeze({
  roomId: 'hero-room',
  sourceBitrateMbps: 6,
  averageDeliveredMbps: 2,
  renditionLadderMbps: Object.freeze([6, 3, 1.5, 0.8]),
  peakViewers: 2100000,
  durationSeconds: 3600,
  deliveryCostPerGBUsd: 0.01
});

/* ── validation: số sai phải nổ lúc load, không phải thành badge sai ở phase 7 ── */
function finite(name, v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(name + ' must be a finite number');
}
function positive(name, v) {
  finite(name, v);
  if (v <= 0) throw new RangeError(name + ' must be > 0');
}
function nonNegative(name, v) {
  finite(name, v);
  if (v < 0) throw new RangeError(name + ' must be >= 0');
}

function validateConfig(c) {
  if (typeof c.roomId !== 'string' || !c.roomId) throw new TypeError('roomId must be a non-empty string');
  positive('sourceBitrateMbps', c.sourceBitrateMbps);
  positive('averageDeliveredMbps', c.averageDeliveredMbps);
  positive('peakViewers', c.peakViewers);
  positive('durationSeconds', c.durationSeconds);
  nonNegative('deliveryCostPerGBUsd', c.deliveryCostPerGBUsd);
  if (!Array.isArray(c.renditionLadderMbps) || !c.renditionLadderMbps.length) {
    throw new TypeError('renditionLadderMbps must be a non-empty array');
  }
  c.renditionLadderMbps.forEach(function(v, i) { positive('renditionLadderMbps[' + i + ']', v); });
}

/* ── provenance ──
   `evidenceClass` nói giá trị được chống lưng tới đâu; `derivationClass` nói
   nó là input hay kết quả tính. Record `derived` bắt buộc có formula và
   inputProvenanceIds — không giấu phép tính trong choreography. */
function buildProvenance(c, deliveredGBPerHour, costPerHourUsd) {
  return [
    {id: 'source-bitrate', value: c.sourceBitrateMbps, unit: 'Mbps', evidenceClass: 'illustrative', derivationClass: 'input', sourceRef: 'livestream-flow3d-concept.md#6-model-contract'},
    {id: 'average-delivered-bitrate', value: c.averageDeliveredMbps, unit: 'Mbps/viewer', evidenceClass: 'illustrative', derivationClass: 'input', sourceRef: 'planning table; chưa có production telemetry'},
    {id: 'hero-peak-viewers', value: c.peakViewers, unit: 'viewers', evidenceClass: 'unverified-source-note', derivationClass: 'input', sourceRef: 'livestream-architecture.md#5-planning-estimate-cho-21-trieu-viewer'},
    {id: 'delivery-rate', value: c.deliveryCostPerGBUsd, unit: 'USD/GB', evidenceClass: 'illustrative', derivationClass: 'input', sourceRef: 'planning table; chưa có provider/date'},
    {id: 'stream-hour-gb', value: deliveredGBPerHour, unit: 'GB/h/stream', evidenceClass: 'illustrative', derivationClass: 'derived', formula: 'averageDeliveredMbps × durationSeconds ÷ 8 ÷ 1000', inputProvenanceIds: ['average-delivered-bitrate']},
    {id: 'delivery-cost-per-hour', value: costPerHourUsd, unit: 'USD/h', evidenceClass: 'illustrative', derivationClass: 'derived', formula: 'deliveredStreams × stream-hour-gb × delivery-rate', inputProvenanceIds: ['stream-hour-gb', 'delivery-rate']}
  ];
}

/* ── Stage 0 · workload `hero-happy-path` ──
   Không núm áp lực nào được vặn, nên ba phase chỉ khác nhau ở đúng một hệ quả:
   uplink tồn tại → subscription được xác nhận → comment đi lane metadata. */
const UNTESTED = Object.freeze({status: 'untested', testedScope: null, testedByWorkloadId: null, reason: 'Stage 0 chỉ chạy happy path; chưa áp pressure nào'});

function planeVerdicts() {
  return {media: UNTESTED, interaction: UNTESTED, financial: UNTESTED, fleet: UNTESTED};
}

const ARCHITECTURE_MVP = Object.freeze({media: 'mvp', interaction: 'mvp', financial: 'absent', fleetPolicy: 'transcode-all'});

/* Bảy núm của pressure rail — Stage 0 hiển thị đủ nhưng chưa vặn núm nào.
   Núm chưa vặn chính là cách deck nói "plane này còn UNTESTED". */
const PRESSURE_KNOBS = Object.freeze(['network', 'viewers', 'distribution', 'latency budget', 'interaction rate', 'retry', 'rooms']);

function stageZeroPhases(c, gbPerStreamHour) {
  const cost = function(streams) { return streams * gbPerStreamHour * c.deliveryCostPerGBUsd; };
  const base = {
    stageId: 'stage-0',
    scope: 'hero-room',
    workloadId: 'hero-happy-path',
    architecture: ARCHITECTURE_MVP,
    testedPlanes: [],
    turnedKnobs: [],
    pressureKnobs: PRESSURE_KNOBS
  };

  return [
    Object.assign({}, base, {
      phaseId: '0a',
      componentLifecycle: {streamer: 'active', 'single-server': 'active', viewer: 'active'},
      visibleKeys: ['streamer', 'single-server', 'viewer'],
      canonicalPaths: [
        {kind: 'media', mode: 'move', label: 'Streamer.Camera/Mic → Streamer.Encoder → Single Server.ingest'}
      ],
      metrics: {publisherUplinks: 1, activeSubscriptions: 0, acceptedComments: 0, viewersPresent: 1, roomState: 'LIVE', roomStateBefore: 'OFFLINE', costUsdPerHour: cost(0)},
      causalContract: {
        primaryClaim: 'Media uplink phải tồn tại trước khi có bất kỳ downlink nào',
        changedInput: 'room state OFFLINE → LIVE',
        heldConstantInputs: ['viewers = 1', 'network = good', 'không núm pressure nào được vặn'],
        affectedPlane: 'media',
        capacityBoundary: 'publisher uplinks = 1',
        latencyTarget: null,
        consistencyRequirement: null,
        failureAssumptions: ['không mô phỏng lỗi mạng hay lỗi node ở Stage 0'],
        invariantIds: ['publisher-uplinks-single']
      },
      provenanceIds: ['source-bitrate', 'delivery-cost-per-hour']
    }),
    Object.assign({}, base, {
      phaseId: '0b',
      componentLifecycle: {streamer: 'active', 'single-server': 'active', viewer: 'active'},
      visibleKeys: ['streamer', 'single-server', 'viewer'],
      canonicalPaths: [
        {kind: 'control', mode: 'no-op', label: 'Viewer → Single Server (join/subscribe)'},
        {kind: 'media', mode: 'copy', label: 'Streamer → Single Server → Viewer'}
      ],
      metrics: {publisherUplinks: 1, activeSubscriptions: 1, activeSubscriptionsBefore: 0, acceptedComments: 0, viewersPresent: 1, roomState: 'LIVE', playerState: 'PLAYING', costUsdPerHour: cost(1)},
      causalContract: {
        primaryClaim: 'Join là control request; media downlink chỉ chạy sau khi subscription được xác nhận',
        changedInput: 'active subscriptions 0 → 1',
        heldConstantInputs: ['publisher uplinks = 1', 'viewers = 1', 'không núm pressure nào được vặn'],
        affectedPlane: 'media',
        capacityBoundary: 'subscription confirmed',
        latencyTarget: null,
        consistencyRequirement: null,
        failureAssumptions: ['không mô phỏng join thất bại hay retry ở Stage 0'],
        invariantIds: ['downlink-after-subscription', 'publisher-uplinks-single']
      },
      provenanceIds: ['average-delivered-bitrate', 'delivery-cost-per-hour']
    }),
    Object.assign({}, base, {
      phaseId: '0c',
      componentLifecycle: {streamer: 'active', 'single-server': 'active', viewer: 'active'},
      visibleKeys: ['streamer', 'single-server', 'viewer'],
      canonicalPaths: [
        {kind: 'media', mode: 'copy', label: 'Streamer → Single Server → Viewer'},
        {kind: 'metadata', mode: 'fork', label: 'Viewer → Single Server.interaction → room subscribers'}
      ],
      metrics: {publisherUplinks: 1, activeSubscriptions: 1, acceptedComments: 1, acceptedCommentsBefore: 0, viewersPresent: 1, roomState: 'LIVE', playerState: 'PLAYING', costUsdPerHour: cost(1)},
      causalContract: {
        primaryClaim: 'Cùng một room vẫn có media path và metadata path khác semantics',
        changedInput: 'accepted comments 0 → 1',
        heldConstantInputs: ['media path không đổi', 'publisher uplinks = 1', 'không núm pressure nào được vặn'],
        affectedPlane: 'interaction',
        capacityBoundary: 'interaction happy path',
        latencyTarget: null,
        consistencyRequirement: 'comment là best-effort delivery, không phải money-safe',
        failureAssumptions: ['không mô phỏng drop hay rate-limit ở Stage 0'],
        invariantIds: ['metadata-lane-separate']
      },
      provenanceIds: ['delivery-cost-per-hour']
    })
  ];
}

function simulate(config) {
  const c = config || DEFAULT_CONFIG;
  validateConfig(c);

  const gbPerStreamHour = c.averageDeliveredMbps * c.durationSeconds / 8 / 1000;
  const phases = stageZeroPhases(c, gbPerStreamHour).map(function(p) {
    p.planeVerdicts = planeVerdicts();
    p.worstPlaneVerdict = 'untested';
    p.scoreboard = {
      scopeLabel: p.scope,
      viewers: p.metrics.viewersPresent,
      costUsdPerHour: p.metrics.costUsdPerHour,
      worstPlane: 'UNTESTED'
    };
    return Object.freeze(p);
  });

  const byId = {};
  phases.forEach(function(p) { byId[p.phaseId] = p; });

  return Object.freeze({
    config: c,
    gbPerStreamHour: gbPerStreamHour,
    phases: Object.freeze(phases),
    byId: Object.freeze(byId),
    provenance: Object.freeze(buildProvenance(c, gbPerStreamHour, gbPerStreamHour * c.deliveryCostPerGBUsd))
  });
}

/* ── formatters ── panel, label và HUD phải in cùng một số theo cùng một cách ── */
function fmtUsd(v) { return 'USD ' + v.toFixed(2).replace('.', ','); }
function fmtMbps(v) { return String(v).replace('.', ',') + ' Mbps'; }
function fmtInt(v) { return v.toLocaleString('vi-VN'); }

const API = {
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  PRESSURE_KNOBS: PRESSURE_KNOBS,
  simulate: simulate,
  fmtUsd: fmtUsd,
  fmtMbps: fmtMbps,
  fmtInt: fmtInt
};

if (typeof window !== 'undefined') window.LIVESTREAM_EVOLUTION_MODEL = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
