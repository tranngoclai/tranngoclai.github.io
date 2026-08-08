/* ══════════════════════════════════════════════
   KUBELET EVICTION — CONDITION, TAINT & RECONCILE (steps ⑥–⑦)

   Killing the Pod is the middle of the story, not the end. Three more actors
   react, each on a different clock, and the scenario gives each its own hop
   because they are genuinely separate components:

     ⑥.1 kubelet   → writes the MemoryPressure NodeCondition
     ⑥.2 node lifecycle controller → turns that condition into a NoSchedule taint
     ⑥.3 eviction-pressure-transition-period holds the condition against flapping
     ⑦.1 ReplicaSet controller → creates a replacement with a NEW UID
     ⑦.2 kube-scheduler → the tainted source Node is no longer a candidate
     ⑦.3 pod garbage collector → why Evicted Pod objects pile up

   The taint is the hop that explains the single most confusing observation in
   this whole mechanism: the replacement Pod does not come back to the Node it
   was just evicted from, and it is not the scheduler being clever — it is a
   taint written by a completely different controller.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const fmtMi = window.KUBELET_EVICTION_MODEL.fmtMi;
const P = window.KUBELET_EVICTION_POS;

window.createKubeletEvictionConsequenceSteps = function(config, run, condition, placement, gc) {
  if (!run.shouldEvict) return [];

  const victim = run.victim;
  const replacementName = victim.name + '′';
  const transitionMinutes = Math.round(condition.transitionSeconds / 60);

  return [

/* ── STEP ⑥: condition → taint → chống dao động ── */
{
  title: 'Node bị đánh dấu — và người gắn taint không phải kubelet',
  pipelineStep: 5,
  focus: ['kubelet', 'apiserver', 'nodelife', 'node'],
  cam: [-5.0, 0, -5.0], dist: 46,
  phases: [
    {
      title: 'kubelet ghi NodeCondition MemoryPressure=True',
      desc: KIT.desc(
        'Song song với việc evict, kubelet cập nhật <b>node status</b>: <code>' + condition.condition + ': ' + condition.status + '</code>.',
        'Đây chỉ là một <i>báo cáo</i> gắn lên object Node trong etcd. Bản thân condition <span class="warn">không ngăn</span> scheduler đặt Pod mới lên Worker A, và cũng không đuổi Pod nào đang chạy.',
        '<b>Condition là quan sát, không phải hành động.</b> Đây là lý do bạn có thể thấy <code>kubectl describe node</code> báo MemoryPressure mà Pod mới vẫn tiếp tục đáp xuống trong vài giây — cho tới khi actor ở phase sau kịp phản ứng.'),
      focus: ['kubelet', 'apiserver', 'node'],
      cam: [-4.0, 0, -3.0], dist: 44,
      set: {
        kubelet: KIT.pulse('warn', 'patch node status', {at: 0.35, dy: 2.5}),
        apiserver: KIT.pulse('warn', condition.condition + '=' + condition.status, {at: 1.3, dy: 3.0}),
        node: KIT.mark('warn', condition.condition + '=' + condition.status, {
          label: 'Worker A\nMemoryPressure', at: 1.3, dy: 3.0,
          hover: 'Condition mới chỉ là báo cáo; chưa có hiệu lực scheduling'
        })
      },
      scene(a) {
        KIT.link(a, 'kubelet', 'apiserver', 'warn', {at: 0.3});
        KIT.note(a, 'condition = quan sát, chưa phải hiệu lực', [-6.0, -3.6, -8.0], 'warn', 1.0);
      }
    },
    {
      title: 'Node lifecycle controller gắn taint — đây mới là thứ có hiệu lực',
      desc: KIT.desc(
        '<b>node lifecycle controller</b> trong kube-controller-manager watch condition đó và gắn taint <code>' + condition.taint + '</code>.',
        'Từ giây phút này, mọi Pod <b>không có toleration tương ứng</b> đều bị NodeResourcesFit… thực ra là bị loại sớm hơn thế, ngay ở <code>TaintToleration</code> filter của scheduler. Worker A biến mất khỏi danh sách ứng viên.',
        '<b>Hai component, hai trách nhiệm — và người ta hay gán nhầm cả hai cho kubelet.</b> kubelet <i>báo cáo</i>; controller <i>áp đặt</i>. Nếu kube-controller-manager gặp sự cố, Node vẫn hiện MemoryPressure nhưng <span class="danger">không bao giờ bị taint</span>, và scheduler sẽ tiếp tục dồn Pod mới vào đúng cái Node đang hấp hối. Lưu ý taint này là <code>NoSchedule</code>, không phải <code>NoExecute</code>: Pod đang chạy <span class="ok">không</span> bị nó đuổi đi.'),
      focus: ['apiserver', 'nodelife', 'node'],
      cam: [-6.0, 0, -7.0], dist: 44,
      set: {
        nodelife: KIT.pulse('danger', 'add taint', {at: 0.9, dy: 2.3}),
        node: KIT.mark('danger', 'taint · NoSchedule', {
          label: 'Worker A\nNoSchedule', at: 1.5, dy: 3.0,
          hover: condition.taint + ' — chặn Pod mới, không đuổi Pod đang chạy'
        })
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'nodelife', 'warn', {at: 0.25});
        KIT.link(a, 'nodelife', 'node', 'danger', {at: 0.95});
        KIT.note(a, 'NoSchedule ≠ NoExecute', [2.5, -3.6, -8.0], 'danger', 1.4);
      }
    },
    {
      title: 'eviction-pressure-transition-period — vì sao taint không tan ngay',
      desc: KIT.desc(
        'Kể cả khi memory hồi phục ở chu kỳ sau, kubelet <b>vẫn giữ</b> condition thêm <code>' + condition.transitionSeconds + 's</code> (' + transitionMinutes + ' phút) trước khi hạ nó xuống <code>False</code>.',
        'Không có khoảng chờ này, Node sẽ dao động: hết áp lực → gỡ taint → scheduler dồn Pod vào → lại áp lực → lại evict. Một vòng lặp tự nuôi chính nó.',
        '<b>Đây thường là điều bạn đang thực sự quan sát khi “Node đã ổn mà vẫn không nhận Pod”.</b> Nó không hỏng, nó đang giữ đúng khoảng đệm chống dao động. Kiên nhẫn ' + transitionMinutes + ' phút, hoặc chỉnh <code>--eviction-pressure-transition-period</code> nếu bạn có lý do rõ ràng.'),
      focus: ['node', 'kubelet', 'nodelife'],
      labels: ['node', 'kubelet'],
      cam: [-2.0, 0, -4.0], dist: 44,
      set: {
        kubelet: KIT.pulse('mute', 'hold ' + transitionMinutes + 'm before clearing', {at: 0.9, dy: 2.5})
      },
      scene(a) {
        KIT.note(a, 'chống flapping: giữ condition ' + transitionMinutes + ' phút', [2.5, -3.6, -8.0], 'mute', 0.6);
      }
    }
  ]
},

/* ── STEP ⑦: dựng lại, xếp chỗ, và dọn xác ── */
{
  title: 'Object mới, Node khác — và đống Evicted còn lại',
  pipelineStep: 6,
  focus: ['apiserver', 'controller', 'replacement'],
  cam: [-6.0, 0, 3.0], dist: 46,
  phases: [
    {
      title: 'ReplicaSet controller tạo replacement với UID mới',
      desc: KIT.desc(
        'Controller thấy actual replicas giảm và tạo <b>' + replacementName + '</b> — một object <i>hoàn toàn mới</i>, UID mới.',
        victim.name + ' cũ <b>không</b> sống lại. Nó nằm nguyên ở <code>Failed/Evicted</code> để bạn còn đọc được lý do. Đó là lý do trong scene này có hai hộp Pod chứ không phải một hộp di chuyển.',
        '<b>Pod không thuộc controller nào thì không có phase này.</b> Một Pod trần (không Deployment/ReplicaSet/StatefulSet) bị evict là <span class="danger">biến mất vĩnh viễn</span> — chỉ còn lại cái xác Failed. Đây là một trong những lý do thực tế nhất để không bao giờ chạy Pod trần trong production.'),
      focus: ['apiserver', 'controller', 'replacement'],
      cam: [-11.0, 0, 2.0], dist: 32,
      show: ['replacement'],
      showAt: {replacement: 1.5},
      set: {
        apiserver: KIT.pulse('accent', 'actual replicas decreased', {at: 0.35, dy: 3.0}),
        controller: KIT.pulse('accent', 'create new UID', {at: 0.95, dy: 2.6}),
        replacement: KIT.mark('subject', 'new UID · Pending', {
          label: replacementName + '\nnew UID · Pending', at: 1.5, dy: 2.0,
          hover: replacementName + ' là object mới, không phải ' + victim.name + ' sống lại'
        })
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'controller', 'accent', {at: 0.25});
        KIT.link(a, 'controller', 'replacement', 'accent', {at: 0.85});
      }
    },
    {
      title: 'Scheduler xét lại — Worker A đã bị taint loại từ vòng filter',
      desc: KIT.desc(
        'Scheduler pop ' + replacementName + ' và chạy filter. <b>Worker A trượt ngay ở TaintToleration</b>, chưa cần tính tới memory.',
        placement.scheduled
          ? 'Worker B còn <code>' + fmtMi(config.workerBFreeMi) + '</code>, đủ cho request <code>' + fmtMi(victim.requestMi) + '</code> → bind <code>spec.nodeName=Worker B</code>, còn lại ' + fmtMi(placement.remainingMi) + '.'
          : 'Worker B chỉ còn <code>' + fmtMi(config.workerBFreeMi) + '</code>, thiếu <b>' + fmtMi(placement.shortfallMi) + '</b> so với request → ' + replacementName + ' nằm <span class="warn">Pending</span>.',
        '<b>Đây là lúc cluster một Node lộ nguyên hình.</b> Không có Worker B, replacement sẽ Pending cho tới khi taint của Worker A được gỡ — tức là sau khi áp lực hết <i>và</i> hết transition period. Eviction <span class="danger">không tạo ra tài nguyên</span>; nó chỉ dời workload sang chỗ khác, và phải có chỗ khác để dời.'),
      focus: ['apiserver', 'scheduler', 'replacement', 'worker-b', 'node'],
      labels: ['scheduler', 'replacement', 'worker-b', 'node'],
      pipelineStep: 7,
      cam: [3.0, 0, 3.0], dist: 58,
      set: {
        apiserver: KIT.pulse('accent', 'Pending Pod observed', {at: 0.25, dy: 3.0}),
        scheduler: KIT.pulse(placement.scheduled ? 'ok' : 'warn',
          placement.scheduled ? 'bind Worker B' : 'no feasible Node', {at: 0.85, dy: 2.6}),
        replacement: placement.scheduled
          ? KIT.move(P.workerBPod, {
              tone: 'live', label: replacementName + '\nBound · Creating',
              badge: 'spec.nodeName=Worker B', at: 1.6, dy: 2.0
            })
          : KIT.mark('warn', 'Pending · no fit', {
              label: replacementName + '\nPending · no fit', at: 1.6, dy: 2.0
            }),
        'worker-b': KIT.mark(placement.scheduled ? 'ok' : 'warn',
          placement.scheduled ? fmtMi(placement.remainingMi) + ' còn trống' : 'insufficient memory', {
            // Clears the replacement Pod's own badge, which lands on the same
            // spot on screen once the Pod is sitting on this platform.
            label: 'Worker B\n' + fmtMi(config.workerBFreeMi) + ' free', at: 1.6, dy: 4.4
          })
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'scheduler', 'accent', {at: 0.2});
        if (placement.scheduled) {
          KIT.link(a, 'scheduler', 'worker-b', 'ok', {at: 0.8});
        } else {
          KIT.note(a, 'Pending: request > Worker B free', [8.0, -3.6, 6.0], 'warn', 0.9);
        }
        KIT.note(a, 'Worker A trượt ở TaintToleration', [2.5, -3.6, -8.0], 'danger', 0.5);
      }
    },
    {
      title: 'Xác Evicted ở lại — pod GC mới là thứ dọn chúng',
      desc: KIT.desc(
        'Container đã chết, nhưng <b>object ' + victim.name + ' vẫn nằm trong etcd</b> ở <code>' + gc.retainedPhase + '/' + gc.retainedReason + '</code>. Không ai xoá nó ngay cả.',
        '<b>pod garbage collector</b> trong kube-controller-manager chỉ dọn Pod đã terminated khi tổng số vượt <code>--terminated-pod-gc-threshold=' + gc.terminatedPodThreshold + '</code>. Dưới ngưỡng đó, chúng tích lại — cố ý, để bạn còn điều tra được.',
        '<b>Vòng lặp khép lại ở chỗ bạn phải can thiệp.</b> Dọn tay bằng <code>' + gc.manualCleanup + '</code> chỉ là dọn triệu chứng. Nguyên nhân nằm ở ba chỗ: <code>requests.memory</code> đặt thấp hơn thực tế (tiêu chí 1 sẽ luôn tóm bạn), <code>PriorityClass</code> quá thấp cho workload quan trọng (tiêu chí 2), hoặc Node đơn giản là quá nhỏ. Eviction là <i>triệu chứng của over-commit</i>, không phải một cái bug cần vá.'),
      focus: ['apiserver', 'podgc', victim.key],
      labels: ['podgc', victim.key],
      pipelineStep: 6,
      cam: [-6.0, 0, 6.0], dist: 50,
      set: {
        podgc: KIT.pulse('mute', 'threshold ' + gc.terminatedPodThreshold + ' · chưa dọn', {at: 1.0, dy: 2.2}),
        [victim.key]: KIT.mark('doomed', 'object vẫn còn trong etcd', {at: 1.3, dy: 2.2})
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'podgc', 'mute', {at: 0.25});
        KIT.note(a, 'eviction = triệu chứng của over-commit', [-4.0, -3.8, 9.0], 'mute', 1.2);
      }
    }
  ]
}

  ];
};
})();
