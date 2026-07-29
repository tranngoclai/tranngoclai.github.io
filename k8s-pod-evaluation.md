# Cách Kubernetes đánh giá ưu tiên khi schedule, evict và kill Pod

## Kết luận cốt lõi

Kubernetes có **ba hệ thống ra quyết định độc lập**:

```text
Scheduler:
PriorityClass → Filter node → Score node → Preemption

Kubelet eviction:
Eviction threshold → Reclaim tài nguyên node → Xếp Pod theo usage/request → Priority

Linux OOM killer:
Memory usage/badness + oom_score_adj → kill process có điểm cao nhất
```

Vì vậy:

* `PriorityClass` cao **không đảm bảo** Pod không bị OOM kill.
* QoS `Guaranteed` **không giúp Pod được scheduler chạy trước**.
* `PodDisruptionBudget` bảo vệ tốt với `drain`/Eviction API nhưng **không bảo vệ node-pressure eviction**.
* Trong node-pressure eviction, việc Pod có **vượt request của tài nguyên đang thiếu hay không** còn quan trọng hơn `PriorityClass`. ([kubernetes.io][1])

---

# 1. Thứ tự quyết định của kube-scheduler

## 1.1. Thứ tự tổng quát

```text
1. Pod có được đưa vào hàng đợi scheduling không?
2. Chọn Pod tiếp theo theo PriorityClass
3. Filter: loại các node không hợp lệ
4. Score: chấm điểm các node còn lại
5. Bind Pod vào node điểm cao nhất
6. Nếu không có node hợp lệ: xem xét preemption
```

Scheduler thực hiện hai bước chính là **Filtering** và **Scoring**. Node không vượt qua Filter sẽ bị loại hoàn toàn; điểm Score cao đến đâu cũng không cứu được. ([Kubernetes][2])

## 1.2. Mức độ ưu tiên các tham số scheduler

| Mức                 | Tham số/cơ chế                                                                  | Tác động                                                     |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1 — Trước scheduler | `schedulingGates`, `schedulerName`                                              | Quyết định Pod đã sẵn sàng scheduling và scheduler nào xử lý |
| 2 — Queue order     | `priorityClassName` / `spec.priority`                                           | Pod priority cao được lấy khỏi hàng đợi trước                |
| 3 — Hard filter     | Requests, taints, required affinity, volume, hostPort, topology `DoNotSchedule` | Không đạt thì node bị loại                                   |
| 4 — Soft score      | Preferred affinity, topology spread, resource balancing, image locality…        | Chọn node tốt nhất trong các node hợp lệ                     |
| 5 — Preemption      | Priority + `preemptionPolicy`                                                   | Có thể xóa Pod priority thấp hơn để tạo chỗ                  |

Default `PrioritySort` sắp Pod trước hết theo priority; khi bằng nhau, scheduler dùng timestamp trong queue để phân thứ tự. ([Go Packages][3])

### Điều dễ nhầm

`PriorityClass` chỉ giúp Pod:

1. Được scheduler xem xét sớm hơn.
2. Có quyền preempt Pod có priority thấp hơn.
3. Được ưu tiên hơn trong một số kiểu kubelet eviction.

Nó **không ghi đè hard constraint**.

Ví dụ Pod priority rất cao vẫn `Pending` nếu:

* Request memory lớn hơn lượng allocatable còn lại.
* Không tolerate taint.
* Không thỏa `nodeSelector`.
* Không thỏa required node/pod affinity.
* PVC không bind được tại node.
* `hostPort` đã bị chiếm.
* Vi phạm topology spread `DoNotSchedule`.

---

# 2. Filter node: nhóm có quyền lực cao nhất

Các điều kiện Filter có tính chất boolean:

```text
Node hợp lệ = Filter1 AND Filter2 AND Filter3 AND ...
```

Một điều kiện fail là node bị loại.

## 2.1. Resource requests

Scheduler sử dụng **requests**, không sử dụng mức CPU/RAM thực tế tại thời điểm scheduling:

```text
sum(requests của các Pod đã schedule)
+ request của Pod mới
<= Node Allocatable
```

Do đó một node thực tế chỉ dùng 20% RAM nhưng tổng memory requests đã gần bằng `Allocatable` vẫn có thể báo `Insufficient memory`. ([Kubernetes][4])

Các resource thường được xét gồm:

* `cpu`
* `memory`
* `ephemeral-storage`
* `hugepages-*`
* Extended resources như GPU

CPU/memory limit thường không trực tiếp quyết định Pod có fit node hay không. Tuy nhiên, nếu chỉ khai báo limit mà không khai báo request và không có cơ chế default khác, Kubernetes có thể copy limit thành request. ([Kubernetes][4])

## 2.2. Effective request của Pod

Với Pod có init container, request dùng để schedule không đơn giản chỉ là tổng container thường. Về cơ bản, Kubernetes tính theo giá trị lớn hơn giữa:

```text
Tổng request của các app/sidecar container chạy đồng thời

và

Request lớn nhất cần thiết trong từng giai đoạn init
```

Sau đó cộng thêm `Pod overhead`, nếu RuntimeClass khai báo overhead. Scheduler tính overhead cùng với container requests. ([Kubernetes][5])

## 2.3. Hard placement constraints

Các cấu hình dưới đây thường là Filter:

* `nodeSelector`
* `nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution`
* `podAffinity.requiredDuringSchedulingIgnoredDuringExecution`
* `podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution`
* Taint `NoSchedule` không có toleration
* Topology spread `whenUnsatisfiable: DoNotSchedule`
* Volume binding/topology
* Host ports
* Node readiness/unschedulable state thông qua taint

`required...` là hard constraint; `preferred...` chỉ dùng để chấm điểm. ([Kubernetes][6])

---

# 3. Score node: không có thứ tự ưu tiên cố định

Sau khi Filter, scheduler chạy các Score plugin và tính gần tương tự:

```text
FinalScore(node) =
  score_plugin_1 × weight_1
+ score_plugin_2 × weight_2
+ ...
```

Vì weights và scheduler profile có thể cấu hình, không tồn tại một bảng chung kiểu:

```text
nodeAffinity luôn mạnh hơn topologySpread
```

Thực tế phụ thuộc vào plugin đang bật và `weight`.

Các Score plugin phổ biến gồm:

* `NodeResourcesFit`
* `NodeResourcesBalancedAllocation`
* `NodeAffinity`
* `InterPodAffinity`
* `PodTopologySpread`
* `TaintToleration`
* `ImageLocality`
* `VolumeBinding`

`NodeResourcesFit` hỗ trợ:

* `LeastAllocated`: ưu tiên node còn nhiều resource; đây là chiến lược mặc định.
* `MostAllocated`: ưu tiên bin packing.
* `RequestedToCapacityRatio`: chấm điểm theo đường cong tùy chỉnh. ([Kubernetes][7])

Hai node có cùng tổng điểm cuối có thể được scheduler chọn ngẫu nhiên. ([Kubernetes][2])

### Hard và soft khác nhau thế nào?

```yaml
requiredDuringSchedulingIgnoredDuringExecution:
```

Là điều kiện bắt buộc, tác động ở Filter.

```yaml
preferredDuringSchedulingIgnoredDuringExecution:
  - weight: 100
```

Chỉ tạo điểm ưu tiên. Node không thỏa vẫn có thể được chọn nếu tổng điểm từ các plugin khác cao hơn.

Tương tự với topology spread:

* `DoNotSchedule`: Filter.
* `ScheduleAnyway`: Score, ưu tiên domain giúp giảm skew. ([Kubernetes][8])

---

# 4. Scheduler preemption: Pod nào bị hy sinh?

Preemption chỉ được thử khi:

1. Pod hiện tại không schedule được.
2. Việc xóa Pod đang chạy có thể làm một node trở nên hợp lệ.
3. `preemptionPolicy` của incoming Pod cho phép preemption.

`preemptionPolicy` mặc định là:

```yaml
preemptionPolicy: PreemptLowerPriority
```

Đặt thành:

```yaml
preemptionPolicy: Never
```

thì Pod vẫn được xếp hàng theo priority cao, nhưng không được xóa Pod khác để giành chỗ. ([Kubernetes][1])

## 4.1. Thứ tự chọn victim

Nguyên tắc mạnh nhất:

```text
Chỉ Pod có priority thấp hơn incoming Pod mới là victim hợp lệ.
```

Scheduler tìm **tập victim tối thiểu** để incoming Pod có thể fit. Trong tập Pod có thể preempt, Pod quan trọng hơn được giữ lại trước, mặc định xét priority cao hơn rồi thời gian chạy lâu hơn. ([Go Packages][9])

Khi so sánh các node ứng viên, scheduler cố gắng:

* Hạn chế vi phạm PDB.
* Chọn tập victim có priority thấp hơn.
* Tránh xóa nhiều Pod hơn mức cần thiết.

## 4.2. QoS không tham gia scheduler preemption

Scheduler preemption **không xét**:

* `Guaranteed`
* `Burstable`
* `BestEffort`
* Actual memory usage
* Actual CPU usage

Nó chủ yếu xét:

* Pod priority.
* Resource requests.
* Các Filter constraint.
* PDB theo dạng best effort.

Một Pod `Guaranteed` priority 100 có thể bị preempt để nhường chỗ cho Pod `Burstable` priority 1000. ([Kubernetes][1])

## 4.3. PDB trong preemption không phải bảo vệ tuyệt đối

Scheduler cố tránh vi phạm PDB, nhưng nếu không tìm được phương án khác thì vẫn có thể preempt Pod dù PDB bị vi phạm. ([Kubernetes][1])

Ngoài ra, preemption không giải quyết được các constraint không liên quan đến việc giải phóng resource, ví dụ:

* Untolerated taint.
* Node label không đúng.
* Không có zone phù hợp.
* PVC topology không phù hợp.
* Host port không thể giải phóng bằng các victim hợp lệ.
* Cross-node anti-affinity cần xóa Pod ở node khác.

---

# 5. Node-pressure eviction: thứ tự thực tế của kubelet

Đây là nơi dễ hiểu sai nhất.

Kubelet theo dõi các signal:

* `memory.available`
* `nodefs.available`
* `nodefs.inodesFree`
* `imagefs.available`
* `imagefs.inodesFree`
* `containerfs.available`
* `containerfs.inodesFree`
* `pid.available` ([Kubernetes][10])

Khi signal vượt threshold:

```text
1. Kubelet cố reclaim resource cấp node
2. Nếu vẫn thiếu, bắt đầu evict end-user Pods
```

Ví dụ với disk pressure, kubelet cố garbage collect dead containers và xóa unused images trước khi evict workload. ([Kubernetes][10])

## 5.1. Comparator chính xác của eviction

Kubelet xếp Pod theo thứ tự:

```text
1. Pod có vượt request của resource đang thiếu không?
2. Pod Priority thấp hơn
3. Mức usage vượt request lớn hơn
```

Nói cách khác, comparator số 1 có quyền lực cao hơn `PriorityClass`. ([Kubernetes][10])

### Ví dụ memory pressure

| Pod | Priority | Memory request | Memory usage | Nhóm         |
| --- | -------: | -------------: | -----------: | ------------ |
| A   |      100 |          4 GiB |        3 GiB | Dưới request |
| B   |      200 |          1 GiB |        2 GiB | Vượt request |
| C   |   10,000 |          1 GiB |        3 GiB | Vượt request |

Thứ tự eviction có xu hướng là:

```text
B trước C, rồi mới đến A
```

Giải thích:

* B và C cùng thuộc nhóm vượt request.
* B có priority thấp hơn C nên B bị chọn trước.
* A dù priority thấp nhất nhưng đang dưới request nên nằm trong nhóm được bảo vệ hơn.

Đây là lý do đặt memory request quá thấp có thể khiến một Pod critical dễ bị eviction, dù đã đặt PriorityClass tương đối cao.

## 5.2. Vai trò thực của QoS

QoS không phải comparator trực tiếp của eviction manager. Nó chỉ là hệ quả của cấu hình request/limit, nên thường dự đoán được xu hướng:

```text
BestEffort → thường bị trước
Burstable → ở giữa
Guaranteed → thường bị cuối
```

Nhưng một quy tắc chính xác hơn là:

```text
usage > request
→ Priority
→ mức vượt request
```

Đối với PID và inode, không tồn tại request tương ứng, nên kubelet chủ yếu dùng Pod Priority và usage liên quan để sắp xếp. Với `DiskPressure`, QoS CPU/memory không phản ánh chính xác thứ tự eviction. ([Kubernetes][10])

## 5.3. PDB và grace period khi node-pressure eviction

Node-pressure eviction:

* Không tôn trọng PDB.
* Không nhất thiết tôn trọng `terminationGracePeriodSeconds`.
* Hard threshold dùng grace period `0s`.
* Soft threshold dùng tối đa `eviction-max-pod-grace-period`. ([Kubernetes][10])

Do đó PDB không thể ngăn kubelet evict MariaDB, Redis hay API critical khi node thực sự thiếu RAM/disk/PID.

---

# 6. Hard và soft eviction threshold

## Hard threshold

Ví dụ:

```yaml
evictionHard:
  memory.available: "500Mi"
  nodefs.available: "10%"
```

Khi chạm threshold, kubelet có thể kill Pod ngay mà không graceful shutdown.

## Soft threshold

```yaml
evictionSoft:
  memory.available: "1Gi"

evictionSoftGracePeriod:
  memory.available: "1m30s"

evictionMaxPodGracePeriod: 30
```

Signal phải duy trì quá grace period mới eviction.

Một lưu ý cấu hình quan trọng: nếu thay đổi một giá trị eviction threshold mà không bật merge default, các threshold mặc định còn lại có thể thành `0`. `MergeDefaultEvictionSettings` kiểm soát việc kế thừa các giá trị mặc định. ([Kubernetes][10])

---

# 7. Linux OOM kill: hoàn toàn khác kubelet eviction

Có hai tình huống OOM chính.

## 7.1. Container vượt memory limit

Memory limit được kernel/cgroup enforce một cách phản ứng. Khi memory pressure xuất hiện, container vượt limit có thể bị OOM kill. CPU limit thì khác: CPU thường bị throttling, không bị kill vì vượt CPU limit. ([Kubernetes][4])

Trong trường hợp này:

* `PriorityClass` không cứu được container.
* PDB không cứu được container.
* Scheduler không tham gia.
* `restartPolicy` quyết định kubelet có restart container hay không.

## 7.2. Toàn node bị OOM

Nếu node OOM trước khi kubelet kịp eviction, Linux OOM killer chọn process dựa trên:

```text
effective OOM score
≈ memory badness/usage + oom_score_adj
```

Kubelet gán `oom_score_adj` gần như sau:

| QoS        |                                               `oom_score_adj` |
| ---------- | ------------------------------------------------------------: |
| Guaranteed |                                                        `-997` |
| BestEffort |                                                        `1000` |
| Burstable  | Tính theo memory request / node memory, trong khoảng `2..999` |

Container thuộc Pod `system-node-critical` cũng được gán mức bảo vệ cao `-997`. Process có effective OOM score cao nhất có xu hướng bị kill. ([Kubernetes][10])

### Hệ quả

Trong node OOM:

```text
Actual memory usage + QoS/request
```

quan trọng hơn PriorityClass thông thường.

Một Pod priority rất cao nhưng `Burstable`, request thấp và dùng RAM lớn vẫn có thể bị kernel kill trước một Pod priority thấp nhưng `Guaranteed`.

---

# 8. Ephemeral-storage eviction

`ephemeral-storage` có cả request và limit:

```yaml
resources:
  requests:
    ephemeral-storage: 2Gi
  limits:
    ephemeral-storage: 4Gi
```

Request ảnh hưởng scheduler fit.

Limit ảnh hưởng runtime. Pod có thể bị đánh dấu eviction nếu:

* Writable layer + container logs vượt container limit.
* Tổng writable layers, logs và `emptyDir` vượt tổng Pod limit.
* Node filesystem đạt DiskPressure threshold. ([Kubernetes][11])

`emptyDir.medium: Memory` được tính như memory usage, không phải disk ephemeral storage.

---

# 9. Taint-based eviction: Priority không quyết định

Taint `NoExecute` hoạt động theo:

```text
Matching toleration?
  Có, không có tolerationSeconds → ở lại vô thời hạn
  Có tolerationSeconds → evict sau số giây đó
  Không có → evict
```

Ví dụ:

```yaml
tolerations:
- key: node.kubernetes.io/unreachable
  operator: Exists
  effect: NoExecute
  tolerationSeconds: 600
```

Trong luồng này, yếu tố quyết định là toleration, không phải QoS hay PriorityClass.

Kubernetes mặc định thêm toleration 300 giây cho `not-ready` và `unreachable`; DaemonSet thường có toleration không giới hạn cho hai taint này. ([Kubernetes][12])

---

# 10. API eviction, drain và PDB

Với:

```bash
kubectl drain
```

hoặc Eviction API, PDB là cơ chế bảo vệ quan trọng:

```yaml
minAvailable: 2
```

hoặc:

```yaml
maxUnavailable: 1
```

Ở đây:

* PDB có thể từ chối eviction.
* PriorityClass không tạo ra thứ tự victim chung.
* `terminationGracePeriodSeconds` được dùng trong quá trình graceful termination.
* Các tùy chọn `--force`, `--disable-eviction`, xóa trực tiếp hoặc node failure có thể thay đổi hành vi.

Tóm lại:

| Cơ chế                         | PDB được tôn trọng? |
| ------------------------------ | ------------------- |
| `kubectl drain` / Eviction API | Có                  |
| Scheduler preemption           | Best effort         |
| Node-pressure eviction         | Không               |
| Kernel OOM kill                | Không               |
| Liveness/startup probe kill    | Không               |
| Container vượt memory limit    | Không               |

---

# 11. Probe kill và graceful termination

Startup hoặc liveness probe fail đủ `failureThreshold` sẽ khiến kubelet kill container, sau đó xử lý theo `restartPolicy`. Readiness probe fail chỉ loại Pod khỏi Service endpoints, không kill container. ([Kubernetes][13])

Các tham số quyết định:

```yaml
initialDelaySeconds:
periodSeconds:
timeoutSeconds:
failureThreshold:
terminationGracePeriodSeconds:
```

Khi Pod bị terminate bình thường:

1. Chạy `preStop`, nếu có.
2. Gửi stop signal, thường là `SIGTERM`.
3. Chờ `terminationGracePeriodSeconds`, mặc định 30 giây.
4. Sau khi hết thời gian, gửi `SIGKILL`. ([Kubernetes][14])

PriorityClass không thay đổi chuỗi này trong termination thông thường.

---

# 12. Bảng tổng hợp độ mạnh của từng tham số

| Tham số                         |    Queue scheduler |                        Node placement |                        Preemption |                       Node-pressure eviction |                Kernel OOM |
| ------------------------------- | -----------------: | ------------------------------------: | --------------------------------: | -------------------------------------------: | ------------------------: |
| `priorityClassName`             |       **Rất mạnh** |                       Không trực tiếp |                      **Rất mạnh** |                      Mạnh, sau usage/request |             Hầu như không |
| CPU request                     |              Không |                          **Rất mạnh** |   Dùng để tính chỗ cần giải phóng | Chỉ khi CPU không phải eviction signal chính |                     Không |
| Memory request                  |              Không |                          **Rất mạnh** |                  Dùng để tính fit |                                 **Rất mạnh** | Ảnh hưởng `oom_score_adj` |
| Memory limit                    |              Không | Gián tiếp nếu được copy thành request |                             Không |                                QoS gián tiếp |  **Cực mạnh**, cgroup OOM |
| Ephemeral request               |              Không |                                  Mạnh |                      Dùng khi fit |                        Mạnh khi DiskPressure |                     Không |
| Ephemeral limit                 |              Không |                       Không trực tiếp |                             Không |                  **Có thể trigger eviction** |                     Không |
| QoS                             |              Không |                                 Không |                             Không |                     Chỉ là chỉ báo gián tiếp |              **Rất mạnh** |
| PDB                             |              Không |                                 Không |                       Best effort |                                        Không |                     Không |
| Required affinity               |              Không |                       **Hard filter** |    Có thể khiến preemption vô ích |                                        Không |                     Không |
| Preferred affinity              |              Không |                     Score theo weight |                     Không đáng kể |                                        Không |                     Không |
| Taint/toleration                |              Không |              **Hard/soft tùy effect** |    Có thể khiến preemption vô ích |        `NoExecute` điều khiển eviction riêng |                     Không |
| `terminationGracePeriodSeconds` |              Không |                                 Không | Quyết định thời gian victim thoát |                      Bị giới hạn hoặc bỏ qua |                     Không |
| `preemptionPolicy`              | Không đổi priority |                                 Không |      **Quyết định quyền preempt** |                                        Không |                     Không |
| Actual usage                    |              Không |                                 Không |                             Không |                                 **Rất mạnh** |              **Cực mạnh** |

---

# 13. Áp dụng cho cluster DOKS v1.33.1 của bạn

Với tình trạng cluster thiếu RAM nhưng thừa CPU, thứ tự ưu tiên nên tập trung vào:

## Quan trọng nhất

1. **Memory requests thực tế**
   Đặt gần working set bình thường/P95, tránh request quá thấp. Request thấp khiến Pod nhanh rơi vào nhóm `usage > request` khi memory pressure.

2. **PriorityClass theo business criticality**
   Dùng để bảo vệ DB, ingress, DNS, storage controller và các control workload khỏi scheduler preemption và giảm nguy cơ kubelet eviction.

3. **Memory limits hợp lý**
   Limit quá thấp gây `OOMKilled`; limit quá cao hoặc không có limit có thể làm node OOM trước khi kubelet phản ứng.

4. **PDB**
   Bảo vệ quá trình drain và maintenance, nhưng không coi PDB là cơ chế chống OOM/node pressure.

5. **System reservation và eviction threshold**
   `systemReserved`, `kubeReserved` và eviction threshold giúp kubelet có khoảng trống phản ứng trước khi kernel OOM.

## Một mô hình PriorityClass thực tế

```yaml
system-node-critical       # Chỉ Kubernetes/node components
system-cluster-critical    # Cluster infrastructure

platform-critical: 100000
database-critical: 50000
frontend-critical: 20000
standard-service: 1000
batch: -1000
overprovisioning: -100000
```

Không nên cấp priority rất cao cho tất cả workload; khi tất cả Pod cùng priority, PriorityClass gần như mất tác dụng phân loại.

## Quy tắc cuối cùng nên ghi nhớ

```text
Muốn Pod được schedule trước:
  PriorityClass

Muốn Pod fit node:
  Requests + hard constraints

Muốn Pod ít bị kubelet eviction:
  Usage không vượt request + PriorityClass hợp lý

Muốn Pod ít bị Linux OOM kill:
  QoS/memory request hợp lý + memory limit + đủ headroom node

Muốn Pod được bảo vệ khi drain:
  PDB

Muốn Pod ở lại khi node unreachable:
  NoExecute tolerationSeconds
```

[1]: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/ "Pod Priority and Preemption | Kubernetes"
[2]: https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/ "Kubernetes Scheduler | Kubernetes"
[3]: https://pkg.go.dev/k8s.io/kubernetes/pkg/scheduler/framework/plugins/queuesort "queuesort package - k8s.io/kubernetes/pkg/scheduler/framework/plugins/queuesort - Go Packages"
[4]: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ "Resource Management for Pods and Containers | Kubernetes"
[5]: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-overhead/?lang=en-US&useContentAccordionItems=px5w6&utm_source=chatgpt.com "Pod Overhead | Kubernetes"
[6]: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/ "Assigning Pods to Nodes | Kubernetes"
[7]: https://kubernetes.io/docs/reference/scheduling/config/ "Scheduler Configuration | Kubernetes"
[8]: https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/?utm_source=chatgpt.com "Pod Topology Spread Constraints | Kubernetes"
[9]: https://pkg.go.dev/k8s.io/kubernetes/pkg/scheduler/framework/plugins/defaultpreemption "defaultpreemption package - k8s.io/kubernetes/pkg/scheduler/framework/plugins/defaultpreemption - Go Packages"
[10]: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/ "Node-pressure Eviction | Kubernetes"
[11]: https://kubernetes.io/docs/concepts/storage/ephemeral-storage/ "Local ephemeral storage | Kubernetes"
[12]: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/?trk=cndc-detail "Taints and Tolerations | Kubernetes"
[13]: https://kubernetes.io/docs/concepts/workloads/pods/probes/ "Liveness, Readiness, and Startup Probes | Kubernetes"
[14]: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/?source=post_page-----7872cec9e568-------------------------------- "Pod Lifecycle | Kubernetes"

