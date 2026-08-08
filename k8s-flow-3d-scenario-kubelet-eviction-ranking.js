/* ══════════════════════════════════════════════
   KUBELET EVICTION — RANK & EVICT (steps ④–⑤)

   The comparator is walked one criterion per phase, in the order kubelet
   actually applies them, because the whole lesson lives in the fact that
   they are ORDERED — Pod C wastes more memory than Pod B and still survives.

     ④.1 exclude static/critical Pods (they never enter the ranking)
     ④.2 criterion 1 — usage above request
     ④.3 criterion 2 — lower Priority, then criterion 3 — larger excess
     ⑤.1 status Failed/Evicted + Event, written BEFORE the kill
     ⑤.2 kill through the CRI, with the grace budget the threshold kind allows
     ⑤.3 one victim per synchronization cycle, then re-sample

   ⑤.1 before ⑤.2 is not cosmetic: kubelet records the eviction first so the
   reason survives even if the node dies mid-kill. Teaching it the other way
   round makes `reason=Evicted` look like a post-mortem guess.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const fmtMi = window.KUBELET_EVICTION_MODEL.fmtMi;
const P = window.KUBELET_EVICTION_POS;

window.createKubeletEvictionRankingSteps = function(config, run) {
  const victim = run.victim;
  const maxUsageMi = run.ranking.reduce(function(max, pod) { return Math.max(max, pod.usageMi); }, 1);
  const maxPriority = run.ranking.reduce(function(max, pod) { return Math.max(max, pod.priority); }, 1);
  const isVictim = function(pod) { return !!victim && pod.key === victim.key; };
  /* The Pod that also exceeds its request and still survives — the entire
     point of criterion 2 outranking criterion 3. */
  const survivor = victim && run.ranking.filter(function(pod) {
    return pod.exceedsRequest && pod.key !== victim.key;
  })[0];

  /* Same rows, same order, across all three ranking phases — a viewer reads
     the criterion by seeing which row moved, not by re-reading the labels. */
  const usageRows = run.ranking.map(function(pod) {
    return KIT.gauge(pod.name, pod.usageMi, maxUsageMi, 'Mi', {
      txt: 'u' + fmtMi(pod.usageMi) + ' / r' + fmtMi(pod.requestMi),
      tone: pod.exceedsRequest ? 'warn' : 'ok'
    });
  });
  const priorityRows = run.ranking.map(function(pod) {
    return KIT.gauge(pod.name, pod.priority, maxPriority, '', {
      txt: 'P' + pod.priority + (pod.exceedsRequest ? ' · +' + fmtMi(pod.excessMi) : ' · within request'),
      tone: isVictim(pod) ? 'danger' : (pod.exceedsRequest ? 'warn' : 'ok'),
      win: isVictim(pod)
    });
  });

  const steps = [

/* ── STEP ④: xếp hạng, theo đúng thứ tự tiêu chí ── */
{
  title: 'Xếp hạng victim — ba tiêu chí, và thứ tự của chúng là tất cả',
  pipelineStep: 3,
  focus: ['kubelet', 'pod-a', 'pod-b', 'pod-c', 'pod-static'],
  phases: [
    {
      title: 'Loại trước: static Pod và critical Pod không bao giờ vào danh sách',
      desc: KIT.desc(
        'Trước khi so sánh bất cứ thứ gì, kubelet <b>gạch bỏ</b> những Pod nó không được phép chọn.',
        'Static Pod, mirror Pod, và Pod có priority ≥ <code>system-cluster-critical</code> (2000000000) bị loại. Ở đây <b>' + (run.excluded[0] ? run.excluded[0].name : 'kube-proxy') + '</b> rời danh sách và không tham gia xếp hạng.',
        '<b>Thuộc DaemonSet <span class="danger">không</span> phải lá chắn.</b> Rất nhiều người tin rằng Pod của DaemonSet miễn nhiễm — không hề. Thứ bảo vệ một Pod là <i>static/mirror</i> hoặc <i>priority đủ cao</i>. Muốn log agent của bạn sống sót qua memory pressure, hãy cho nó một <code>PriorityClass</code> cao, đừng trông cậy vào việc nó là DaemonSet.'),
      focus: ['kubelet', 'pod-static'],
      set: {
        kubelet: KIT.pulse('info', 'filter candidates', {at: 0.4, dy: 2.5}),
        'pod-static': KIT.mark('peer', 'excluded · not a candidate', {
          at: 1.2, dy: 2.1,
          hover: 'Static/critical Pod: kubelet không chọn làm victim node-pressure'
        })
      },
      scene(a) {
        KIT.link(a, 'kubelet', 'pod-static', 'mute', {at: 0.3, label: 'exclude · not a candidate'});
        KIT.note(a, 'DaemonSet ≠ miễn nhiễm', {of: 'pod-static', band: true}, 'warn', 0.9);
      }
    },
    {
      title: 'Tiêu chí 1 — Pod nào dùng vượt request của chính nó',
      desc: KIT.desc(
        'Tiêu chí đầu tiên <b>không</b> phải Priority, cũng không phải “ai dùng nhiều nhất”. Nó là: <code>usage &gt; requests</code>?',
        run.ranking.filter(function(p) { return p.exceedsRequest; }).map(function(p) { return p.name; }).join(' và ') + ' vượt request nên vào <span class="warn">nhóm bị xét trước</span>. Pod A dùng ' + fmtMi(config.pods[0].usageMi) + ' nhưng đã xin ' + fmtMi(config.pods[0].requestMi) + ' — <b>trong phần nó đã đăng ký</b>, nên tụt xuống nhóm sau.',
        '<b>Đây là chỗ request cứu bạn.</b> Pod A tiêu thụ nhiều RAM hơn Pod B, nhưng vẫn an toàn hơn — vì nó khai báo trung thực. Một Pod không đặt <code>requests.memory</code> có request = 0, nên <span class="danger">mọi byte nó dùng đều là “vượt request”</span>, và nó gần như luôn đứng đầu danh sách bị giết. Đặt requests sát thực tế là cách phòng thủ rẻ nhất trước node-pressure eviction.'),
      focus: ['kubelet', 'pod-a', 'pod-b', 'pod-c'],
      set: run.ranking.reduce(function(set, pod) {
        set[pod.key] = KIT.mark(pod.exceedsRequest ? 'warn' : 'ok',
          pod.exceedsRequest ? 'vượt request +' + fmtMi(pod.excessMi) : 'trong request',
          {at: 0.9, dy: 2.1});
        return set;
      }, {}),
      scoreMode: true,
      scoreTitle: 'tiêu chí 1 · usage so với request',
      scores: usageRows,
      scene(a) {
        KIT.note(a, 'requests = 0 → mọi byte đều là "vượt"', {of: 'pod-b', band: true}, 'danger', 0.8);
      }
    },
    {
      title: 'Tiêu chí 2 rồi 3 — Priority trước, mức vượt sau',
      desc: KIT.desc(
        run.shouldEvict
          ? 'Trong nhóm vượt request, kubelet so <b>Priority</b> trước. Thấp hơn thua. Victim là <b>' + victim.name + '</b>.'
          : 'Comparator vẫn chạy để xếp hạng, nhưng chu kỳ này không sinh victim.',
        survivor
          ? survivor.name + ' vượt request tới <b>+' + fmtMi(survivor.excessMi) + '</b>, nhiều hơn ' + victim.name + ' (+' + fmtMi(victim.excessMi) + ') — nhưng Priority <code>' + survivor.priority + '</code> của nó đứng trên <code>' + victim.priority + '</code>, nên nó <span class="ok">sống sót</span>. Mức vượt chỉ là tiêu chí <b>thứ ba</b>, dùng để phân định khi Priority bằng nhau.'
          : 'Mức vượt request chỉ là tiêu chí <b>thứ ba</b>, dùng để phân định khi Priority bằng nhau.',
        '<b>Đảo thứ tự hai tiêu chí này là hiểu sai cơ chế.</b> “Pod nào phá nhiều nhất thì chết trước” nghe hợp lý nhưng sai: một Pod rò rỉ bộ nhớ khủng khiếp với PriorityClass cao vẫn tồn tại, trong khi Pod hơi vượt request một chút với priority mặc định thì bị dọn. Priority là cái van bạn thật sự điều khiển được.'),
      focus: ['kubelet', 'pod-a', 'pod-b', 'pod-c'],
      set: run.ranking.reduce(function(set, pod) {
        set[pod.key] = KIT.mark(isVictim(pod) ? 'doomed' : (pod.exceedsRequest ? 'warn' : 'ok'),
          (isVictim(pod) ? 'victim · ' : '') + 'rank #' + pod.rank,
          {at: 0.6 + (pod.rank - 1) * 0.25, dy: 2.1});
        return set;
      }, {
        kubelet: KIT.pulse(run.shouldEvict ? 'danger' : 'ok',
          run.shouldEvict ? victim.name + ' selected' : 'no eviction', {at: 1.4, dy: 2.5})
      }),
      scoreMode: true,
      scoreTitle: run.shouldEvict ? 'tiêu chí 2 · Priority (thấp hơn thua)' : 'ranking preview · không có victim',
      scores: priorityRows,
      scene(a) {
        run.ranking.forEach(function(pod, i) {
          // One line per ranked Pod out of the same component — `lift` keeps
          // them from collapsing into a single stroke.
          KIT.link(a, 'kubelet', pod.key, isVictim(pod) ? 'danger' : 'mute',
            {at: 0.25 + i * 0.18, lift: i * 0.3, label: 'rank #' + pod.rank});
        });
        KIT.note(a, 'PDB không được hỏi ý kiến ở đây', {of: 'kubelet', band: true}, 'warn', 1.2);
      }
    }
  ]
}

  ];

  if (!run.shouldEvict) return steps;

  /* ── STEP ⑤: chấm dứt victim ── */
  steps.push({
    title: 'Chấm dứt victim — ghi sổ trước, giết sau',
    pipelineStep: 4,
    focus: ['kubelet', 'runtime', victim.key],
    phases: [
      {
        title: 'Ghi status Failed/Evicted và Event — TRƯỚC khi container bị dừng',
        desc: KIT.desc(
          'Việc đầu tiên kubelet làm <b>không</b> phải gửi tín hiệu giết, mà là ghi lại lý do: <code>phase=Failed</code>, <code>reason=Evicted</code>, kèm một Event lên API Server.',
          'Message của Event nêu đúng signal đã kích hoạt: <code>The node was low on resource: memory. Threshold quantity: ' + fmtMi(run.threshold.thresholdMi) + '</code>. Object Pod bây giờ đã mang bằng chứng, dù container còn đang chạy.',
          '<b>Vì sao thứ tự này quan trọng:</b> nếu kubelet giết trước rồi mới ghi, một Node chết giữa chừng sẽ để lại Pod chết <span class="warn">không rõ nguyên nhân</span>. Ghi trước nghĩa là <code>kubectl describe pod</code> luôn nói cho bạn biết vì sao — đây chính là dòng chữ phân biệt <code>Evicted</code> (kubelet, do node pressure) với <code>OOMKilled</code> (kernel, do vượt limit).'),
        focus: ['kubelet', 'apiserver', victim.key],
        set: {
          kubelet: KIT.pulse('danger', 'status + Event', {at: 0.35, dy: 2.5}),
          apiserver: KIT.pulse('danger', victim.name + ' Failed/Evicted', {at: 1.3, dy: 3.0}),
          [victim.key]: KIT.mark('doomed', 'reason=Evicted', {at: 1.3, dy: 2.1})
        },
        scene(a) {
          KIT.link(a, 'kubelet', 'apiserver', 'danger', {at: 0.3, label: 'write status + Event'});
          KIT.note(a, 'Evicted ≠ OOMKilled', {of: 'apiserver', band: true}, 'danger', 1.0);
        }
      },
      {
        title: 'Rồi mới gọi CRI dừng container — với ngân sách grace của threshold',
        desc: KIT.desc(
          'Kubelet gọi <b>container runtime</b> qua CRI để dừng các container của ' + victim.name + '. Runtime mới là thứ thực thi; kubelet không tự gửi signal.',
          run.threshold.kind === 'hard'
            ? 'Hard eviction cấp grace <code>' + run.threshold.podGracePeriodSeconds + 's</code>: <code>terminationGracePeriodSeconds</code> của Pod <b>bị bỏ qua</b>, SIGTERM và SIGKILL gần như liền nhau.'
            : 'Soft eviction honor <code>terminationGracePeriodSeconds</code> của Pod nhưng cắt trần ở <code>evictionMaxPodGracePeriod=' + run.threshold.podGracePeriodSeconds + 's</code>.',
          '<b>“Grace 0s” không có nghĩa tức thời.</b> Vẫn phải qua CRI, qua syscall, qua việc kernel thu hồi trang nhớ. Trong lúc đó memory chưa hề được trả lại. Nếu bạn cần app kịp flush dữ liệu, <span class="danger">hard eviction không cho bạn cơ hội đó</span> — hãy dùng soft threshold với grace period, hoặc đừng để Node chạm ngưỡng.'),
        focus: ['kubelet', 'runtime', victim.key],
        set: {
          kubelet: KIT.pulse('danger', 'kill ' + victim.name, {at: 0.35, dy: 2.5}),
          runtime: KIT.pulse('danger', 'CRI StopContainer', {at: 0.9, dy: 2.1}),
          [victim.key]: KIT.move(P.evicted, {
            tone: 'danger', label: victim.name + '\nFailed · Evicted', badge: 'containers stopped',
            at: 1.6, dy: 2.2,
            hover: victim.name + ': cùng một object, giờ ở phase Failed — không phải Pod mới'
          })
        },
        scene(a) {
          KIT.link(a, 'kubelet', 'runtime', 'danger', {at: 0.3, label: 'CRI StopContainer'});
          KIT.link(a, 'runtime', victim.key, 'danger', {at: 0.85, label: 'stop containers'});
          KIT.note(a, 'grace ' + run.threshold.podGracePeriodSeconds + 's ≠ tức thời', {of: victim.key, band: true}, 'danger', 1.2);
        }
      },
      {
        title: 'Đúng một victim cho mỗi cycle — rồi đo lại từ đầu',
        desc: KIT.desc(
          'Kubelet <b>dừng lại ở đây</b>. Nó không đi tiếp xuống rank #2, dù danh sách vẫn còn Pod.',
          'Chu kỳ sau nó lấy mẫu <i>mới</i> từ Summary API và xếp hạng <i>lại</i> từ đầu. Phép cộng ' + fmtMi(run.threshold.availableMi) + ' + ' + fmtMi(victim.usageMi) + ' = ' + fmtMi(run.projectedAvailableMi) + ' chỉ là <span class="warn">ước lượng dạy học</span>, không phải điều kubelet tin.',
          '<b>Hệ quả thực tế:</b> nếu áp lực vẫn còn, bạn sẽ thấy các Pod bị evict <i>lần lượt</i>, cách nhau khoảng một chu kỳ ' + config.monitoringPeriodSeconds + 's — chứ không phải một loạt cùng lúc. Thấy 5 Pod <code>Evicted</code> trong cùng một giây thì hãy nghi ngờ một nguyên nhân khác, ví dụ Node restart hay kernel OOM.'),
        focus: ['kubelet', 'cadvisor', 'node'],
        set: {
          cadvisor: KIT.pulse('warn', 'resample next cycle', {at: 1.0, dy: 2.1}),
          node: KIT.mark(run.needsAnotherCycleEstimate ? 'warn' : 'ok',
            run.needsAnotherCycleEstimate ? 'pressure may persist' : 'projected above target', {
              label: 'Worker A\n' + (run.needsAnotherCycleEstimate ? 'Re-sample' : 'Projected OK'),
              at: 1.2, dy: 3.0
            })
        },
        scoreMode: true,
        scoreTitle: 'ước lượng dạy học · chu kỳ sau phải đo lại',
        scores: [
          KIT.gauge('trước', run.threshold.availableMi, run.measured.capacityMi, 'Mi', {tone: 'danger'}),
          KIT.gauge('target', run.targetMi, run.measured.capacityMi, 'Mi', {tone: 'warn'}),
          KIT.gauge('ước lượng sau', run.projectedAvailableMi, run.measured.capacityMi, 'Mi', {
            tone: run.needsAnotherCycleEstimate ? 'warn' : 'ok'
          })
        ],
        scene(a) {
          KIT.link(a, 'kubelet', 'cadvisor', 'warn', {at: 0.3, label: 'resample next cycle'});
          KIT.note(a, 'một victim / cycle · cách nhau ~' + config.monitoringPeriodSeconds + 's', {of: 'cadvisor', band: true}, 'warn', 0.9);
        }
      }
    ]
  });

  return steps;
};
})();
