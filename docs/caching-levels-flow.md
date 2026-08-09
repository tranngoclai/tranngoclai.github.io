# Flow caching cho hệ thống e-commerce product page: 9 level cache

Nguồn: [Understanding Different Levels of Caching in System Design](https://freedium-mirror.cfd/@sauravx25/understanding-different-levels-of-caching-in-system-design-c8b772174e2e)

Hệ thống mẫu: **ShopHub**, trang chi tiết sản phẩm `PID-4521` (Wireless
Headphones Pro, giá $89.99, tồn kho 120), render kiểu **SSR/SSG** (Next.js
ISR-style: HTML render sẵn ở server, revalidate định kỳ) — chọn SSR vì
product page cần SEO (Google index giá/tồn kho), SPA thuần không hợp cho case
này. Dùng 1 sản phẩm xuyên suốt mọi scenario để flow nối được với nhau, giống
cách `k8s-pod-evaluation.md` dùng 1 cluster DOKS xuyên suốt.

## Kết luận cốt lõi

```text
Read path (client bấm vào trang sản phẩm):
DNS → Browser cache → CDN → LB/reverse-proxy → App cache (Redis)
  → [miss] ORM cache → DB engine cache → OS page cache → Disk

Write path (admin sửa giá/tồn kho PID-4521):
DB write → DB engine cache (update buffer pool + ghi WAL) → OS page cache (dirty page)
  → ORM cache (auto-invalidate qua signal) → App cache (Pub/Sub invalidate)
  → LB/reverse-proxy (purge) → CDN (purge) → Browser (chờ hết TTL/ETag)
```

9 level chia 2 nhóm:

* **8 level runtime** — nằm trên đường đi của 1 HTTP request, quyết định
  latency và độ tươi của dữ liệu user thấy.
* **1 level build-time** (Webpack/CI) — không nằm trên request path, chỉ ảnh
  hưởng tốc độ deploy ra bundle mới; xử lý như 1 scenario riêng ở cuối.

Nguyên tắc xuyên suốt mọi level, y hệt tinh thần bài k8s doc:

> Level càng gần client, TTL càng dễ set dài nhưng càng khó revoke tức thời.
> Level càng gần disk, invalidation càng "tự động đúng" nhưng latency cứu
> được càng ít.

---

# 1. DNS Resolver Cache

**Vị trí:** OS resolver (client) + resolver ISP.
**Cache:** `shophub.com` → `203.0.113.10`.
**TTL:** ví dụ `300s` set trên DNS record.

```text
1. Browser hỏi OS resolver: shophub.com?
2. OS cache còn hạn (< 300s) → trả ngay, không query mạng
3. Hết hạn → hỏi resolver ISP
4. Resolver ISP còn cache → trả, cache lại ở OS resolver
5. Miss cả 2 → query authoritative nameserver → cache ở cả 2 tầng theo TTL
```

**Trade-off:** TTL cao → giảm query nhưng khi ShopHub đổi IP (migrate hạ
tầng), client vẫn resolve ra IP cũ tới khi TTL hết → cần hạ TTL trước migrate
(giống pattern "giảm blast radius trước khi đổi state" trong k8s drain).

**Không cache được:** domain mới toanh (cold), hoặc `Cache-Control` DNS-level
override bởi client (`ipconfig /flushdns`).

---

# 2. Browser Cache

**Vị trí:** client, disk/memory cache của browser.
**Cache:** JS/CSS bundle, ảnh hero sản phẩm, KHÔNG cache giá/tồn kho (API).

| Resource | Header | Lý do |
| --- | --- | --- |
| `main.[hash].js`, `styles.[hash].css` | `Cache-Control: max-age=31536000, immutable` | filename có hash, đổi nội dung = đổi URL |
| `product-4521-hero.jpg` | `Cache-Control: max-age=86400` + `ETag` | ảnh ít đổi, vẫn cần revalidate sau 1 ngày |
| `GET /api/products/4521` (giá, tồn kho) | `Cache-Control: no-store` hoặc `max-age=0, must-revalidate` | giá/tồn kho đổi theo phút, browser cache là nguồn stale-price nguy hiểm nhất |

```text
1. Request resource
2. Có trong cache & còn fresh (max-age chưa hết) → dùng thẳng, không ra mạng
3. Có trong cache nhưng stale → gửi conditional GET (If-None-Match: ETag)
4. Server: nội dung không đổi → 304 Not Modified (không gửi lại body)
   Server: nội dung đổi → 200 + body mới + ETag mới
```

**Sai lầm thường gặp:** để browser cache API giá theo default heuristic
(không set `Cache-Control`) → user thấy giá cũ dù DB đã update, không phải
lỗi ở tầng nào sau đó cả, lỗi ngay từ header response.

---

# 3. CDN

**Vị trí:** edge PoP phân tán toàn cầu (Cloudflare/Fastly/CloudFront).
**Cache:** static asset, ảnh, VÀ **HTML rendered của trang sản phẩm** (SSR
output từ origin) — vì ShopHub dùng SSR/SSG, page `/products/4521` là 1 file
HTML tĩnh tính tới lúc revalidate, edge cache được nguyên trang chứ không chỉ
asset. KHÔNG cache API giá/tồn kho gọi client-side (nếu có phần dynamic sau
hydrate) trực tiếp, trừ khi set TTL ngắn + stale-while-revalidate.

**Cache key mặc định:** URL + query string (không tính cookie/header trừ khi
config `Vary`).

```text
1. Request tới edge PoP gần nhất
2. Hit + fresh → trả từ edge, không chạm origin
3. Hit + stale, có stale-while-revalidate → trả bản cũ NGAY, đồng thời fetch
   bản mới ở background để cập nhật cache cho lần sau
4. Miss → forward tới origin (qua LB, level 4), cache lại response tại edge
```

**Invalidation:** deploy xong bundle mới → gọi purge API xoá theo URL/tag.
Purge CDN **không purge được browser cache** (level 2) — 2 tầng độc lập, user
đang mở tab cũ vẫn thấy asset cũ tới khi browser tự revalidate.

**Edge case đặc thù ecommerce:** ảnh sản phẩm cache theo URL cố định
(`/img/4521.jpg`) → đổi ảnh sản phẩm nhưng giữ nguyên URL = user thấy ảnh cũ
tới khi TTL hết, kể cả sau khi origin đã có ảnh mới. Fix: đổi URL theo hash
content (giống asset ở level 2), không tái dùng URL cũ.

**Riêng với HTML SSR:** khi admin đổi giá, origin re-render lại
`/products/4521` (ISR: on-demand revalidate hoặc theo TTL ngắn, vd 60s) →
edge phải purge/refetch bản HTML cũ. Đây là lý do trang giá hay đổi (flash
sale) thường set revalidate TTL ngắn hơn nhiều so với trang ít đổi, đánh đổi
cache-hit-rate lấy độ tươi.

---

# 4. Load Balancer / Reverse Proxy

**Vị trí:** trước app server (Nginx/Varnish/Envoy).
**Cache:** **full HTML page đã SSR** cho request không cá nhân hoá — `GET
/products/4521` trả về nguyên trang giống nhau cho mọi user chưa login, đây
là nơi cache toàn trang trước khi CDN kịp có bản edge. `GET
/api/products/4521` (API riêng, nếu FE gọi thêm sau hydrate) cũng cache được
tương tự nhưng TTL nên ngắn hơn HTML.

**Cache key:** `method + path + query + Vary header` (thường `Vary:
Cookie/Authorization` để tách response đã login vs anonymous).

```text
1. Request tới LB
2. Match cache key, còn fresh → trả thẳng, KHÔNG forward vào app (level 5+)
3. Backend app trả 5xx và có bật stale-if-error → trả bản cache cũ thay vì lỗi
4. Miss → forward vào app, cache lại response theo config TTL
```

**Vì sao tách riêng level này khỏi CDN:** CDN ở xa (multi-region), LB/reverse
proxy đứng ngay trước app, thường dùng để cache response có logic hơi động
(vd theo currency header) mà CDN edge không tiện config, và để chặn traffic
spike trước khi chạm app process — giảm tải mà không cần round-trip ra edge.

**Invalidation:** cấu hình TTL ngắn (giây) hoặc purge theo path khi admin
update giá — thường dùng cache tag để purge chính xác `product:4521` thay vì
flush toàn bộ.

---

# 5. Application Layer (Redis/Memcached, in-memory cache)

**Vị trí:** trong code app, dùng Redis/Memcached ngoài process.
**Cache:** object sản phẩm đầy đủ, key `product:4521` →
`{id,name,price,stock}`, session user, kết quả tính toán đắt (vd gợi ý sản
phẩm liên quan).

**Pattern:** cache-aside (lazy loading).

```text
1. App nhận request lấy product 4521
2. GET product:4521 từ Redis
3. Hit → trả thẳng, KHÔNG chạm DB (level 6/7/8)
4. Miss → query DB (qua ORM, level 7) → SET product:4521 vào Redis với TTL
   → trả kết quả
```

**Invalidation khi admin sửa giá:**

```text
1. Admin PATCH giá PID-4521: 89.99 → 79.99
2. App UPDATE DB
3. App DEL product:4521 (hoặc publish Pub/Sub "product:4521:invalidate" nếu
   nhiều app instance cùng share cache logic — mỗi instance subscribe và tự
   xoá local reference)
4. Request tiếp theo miss → query lại DB → cache giá mới
```

**Race condition kinh điển (thundering herd + stale write):** 2 request A, B
cùng miss cache tại đúng lúc admin đang update giá. A đọc DB được giá cũ
(trước update), B đọc DB được giá mới (sau update). Nếu A ghi vào Redis SAU
B, cache sẽ mang giá cũ dù DB đã có giá mới → cần lock ngắn hoặc so sánh
version/timestamp trước khi ghi cache.

---

# 6. Database-Level Cache

**Vị trí:** trong chính DB engine (MySQL InnoDB buffer pool, Postgres
`shared_buffers`).
**Cache:** data page + index page của bảng `products` trong RAM của DB
process.

```text
1. Query SELECT * FROM products WHERE id=4521
2. Data page của row này đã có trong buffer pool → đọc RAM, không đụng disk
3. Miss → đọc từ disk vào buffer pool, evict page ít dùng nhất (LRU) nếu pool
   đầy, trả kết quả
```

**Không cần invalidate thủ công** — khi UPDATE giá, DB engine tự sửa page
trong buffer pool + ghi WAL, cache và nguồn luôn đồng bộ theo transaction
log, khác hẳn level 5 (Redis) phải tự tay xoá key.

**Cold-cache penalty:** DB restart (deploy, failover) → buffer pool rỗng →
loạt query đầu tiên đều miss, đọc disk chậm, cho tới khi pool "warm" lại. Với
site traffic cao, đây là lý do restart DB giờ thấp điểm hoặc dùng buffer pool
dump/restore khi restart.

---

# 7. ORM-Based Transparent Caching

**Vị trí:** giữa app code và DB, ORM layer (vd Django + `django-cacheops`).
**Cache:** kết quả query ORM, key tự sinh từ SQL + params, vd
`Product.objects.get(id=4521)`.

```text
1. App gọi Product.objects.get(id=4521) qua ORM
2. cacheops match được query đã cache trước đó, còn hạn → trả object Python
   luôn, không sinh SQL, không chạm DB (level 6)
3. Miss → sinh SQL thật, query DB, cache lại kết quả theo rule khai báo
```

**Auto-invalidation:** cacheops hook vào signal `post_save`/`post_delete` của
model — `Product.objects.filter(id=4521).update(price=...)` qua ORM sẽ tự
kích hoạt xoá cache liên quan, không cần code thủ công như level 5.

**Bẫy lớn nhất của level này:** update **né ORM** — raw SQL
(`cursor.execute("UPDATE products SET price=...")`) hoặc bulk update trực
tiếp trong DB (migration script, admin chạy SQL tay) — không đi qua signal
Django nên cacheops **không biết** để invalidate. Kết quả: DB đã đổi giá,
buffer pool (level 6) đã đổi, nhưng ORM cache (level 7) vẫn trả giá cũ vì nó
đứng "phía trên" DB engine trong đường đọc.

---

# 8. Operating System (Kernel Page Cache)

**Vị trí:** OS level, dưới cả DB engine.
**Cache:** toàn bộ file DB (data file, WAL) từng đọc từ disk được kernel giữ
lại trong RAM free, tự động, ngoài tầm kiểm soát app/DB config.

```text
1. DB engine (level 6) đọc file data từ disk lần đầu
2. Kernel giữ block đó trong page cache
3. Lần đọc sau (kể cả process khác, hoặc DB restart) → kernel trả từ RAM
   trước khi phải seek disk thật
4. Memory pressure tăng → kernel tự evict page cache (kswapd), ưu tiên giữ
   page đang active
```

**Không app nào invalidate trực tiếp** — hoàn toàn tự động, monitor bằng
`vmstat`/`free -m`.

**Liên hệ với `k8s-pod-evaluation.md` trong repo này:** nếu DB chạy trong
container/pod trên k8s, page cache này **tính vào cgroup memory usage** của
container. Khi cgroup chạm limit, kernel **reclaim page cache sạch trước**
(không kill ngay) — container chỉ bị OOM kill khi reclaim không đủ/không kịp,
thường do page cache đang **dirty** (chưa flush disk, chưa reclaim được) hoặc
app allocate đột ngột nhanh hơn tốc độ reclaim. Với DB write-heavy (nhiều
dirty page từ WAL), rủi ro OOM kill cao hơn hẳn workload đọc nhiều, đúng cơ
chế "Container vượt memory limit" ở mục 7.1 của doc k8s. Đây là lý do set
memory limit cho pod DB cần chừa headroom cho page cache, không chỉ tính
working set của DB process.

---

# 9. Build/Compiler-Level Cache (deploy-time, tách riêng khỏi request path)

**Vị trí:** CI/CD pipeline, không chạy khi user request trang sản phẩm.
**Cache:** artifact build không đổi — `node_modules` theo hash
`package-lock.json`, output biên dịch từng module Webpack/Vite không đổi nội
dung, Docker layer cache.

```text
1. CI job bắt đầu build
2. Cache key = hash(package-lock.json) cho bước install dependency
   → không đổi → restore từ cache, skip npm install
3. Webpack/Vite: file nào không đổi nội dung → tái dùng output biên dịch cũ
   (persistent cache trên disk CI runner)
4. Chỉ build lại module đã đổi → output bundle mới (main.[hash].js)
5. Push bundle mới lên origin → trigger purge CDN (level 3)
   → browser (level 2) tự thấy filename hash mới nên tự động fetch lại,
     không cần "invalidate" browser cache theo nghĩa thông thường
```

**Vì sao tách riêng scenario này:** nó không nằm trên đường đi của 1 HTTP
request tới trang sản phẩm — nó là tiền đề tạo ra asset mà level 2/3 sẽ
cache. Gộp chung vào read/write path (như 8 level kia) sẽ làm sai bản chất
runtime vs build-time, vi phạm đúng rule "Node placement biết về resource
request nhưng resource request không biết về node placement" kiểu phân lớp
one-way mà `flow3d-deck-authoring.md` áp dụng cho layer model/world/steps.

---

# 10. Bảng tổng hợp

| Level | Ai kiểm soát | Invalidation | Nếu stale thì sao |
| --- | --- | --- | --- |
| 1. DNS | DNS TTL config | Chờ hết TTL | Resolve nhầm IP cũ sau migrate |
| 2. Browser | Response header (`Cache-Control`/`ETag`) | Conditional GET, hoặc filename hash đổi | User thấy giá/asset cũ, sai nhiều nhất nếu quên set header cho API động |
| 3. CDN | Edge config + purge API | Purge theo URL/tag, hoặc TTL | User vùng khác thấy asset cũ tới khi TTL/purge lan tới PoP đó |
| 4. LB/reverse-proxy | Proxy config, cache tag | Purge theo tag, TTL ngắn | Spike traffic đọc cache cũ thay vì app, thường chấp nhận được vài giây |
| 5. App (Redis) | Code app | DEL thủ công / Pub-Sub / TTL | Giá/tồn kho sai tới khi TTL hết hoặc invalidate event tới |
| 6. DB engine | DB tự quản | Tự động theo WAL, không cần app can thiệp | Gần như không stale nếu cùng 1 instance DB |
| 7. ORM cache | ORM library (cacheops...) | Auto qua signal `save()`/`delete()` | Stale nếu write né ORM (raw SQL, bulk update ngoài ORM) |
| 8. OS page cache | Kernel | Tự động, evict khi memory pressure | Không stale data-wise, nhưng cộng dồn vào cgroup limit → risk OOM kill |
| 9. Build cache | CI config | Cache key = hash(lockfile/source) | Build ra bundle cũ nếu hash key tính sai (vd quên hash theo nội dung file) |

**Cold cache toàn hệ thống** (deploy fresh, restart hạ tầng): không phải 1
scenario riêng, chỉ là 9 scenario trên đều rơi vào nhánh **miss** cùng lúc —
level 1-9 đều query "nguồn thật" 1 lần, latency request đầu tiên = tổng
disk/network I/O thật, không có shortcut nào. Site chịu load cao ngay sau
deploy/restart chính là hệ quả cộng dồn của toàn bộ cold-miss này.

---

# 11. Áp dụng cho ShopHub

## Thứ tự ưu tiên khi thiết kế

```text
Muốn giảm latency nhiều nhất:
  Cache càng gần client càng tốt (level 1-4), nhưng rủi ro stale cũng tăng
  theo hướng đó

Muốn dữ liệu luôn đúng (giá, tồn kho):
  Set TTL ngắn hoặc no-cache ở level 2-4 cho API động, dồn cache mạnh vào
  level 5-8 nơi có invalidation event rõ ràng (DEL, signal, WAL)

Muốn build/deploy nhanh:
  Build cache (level 9) không ảnh hưởng gì tới correctness của request path,
  tối ưu tự do
```

## Rủi ro cụ thể cần né

1. **Đừng để browser cache API giá** (level 2) — lỗi phổ biến nhất, sai
   ngay từ response header, không phải lỗi logic sau đó.
2. **Đừng update DB bằng raw SQL nếu có ORM cache** (level 7) — cache sẽ
   lệch DB mà không ai biết tới khi user report giá sai.
3. **Đừng set memory limit pod DB chỉ theo working set** — quên page cache
   (level 8) là nguyên nhân OOM kill khó debug nhất, đã có trong
   `docs/k8s-pod-evaluation.md` mục 7.2.
4. **Đừng coi purge CDN là xong việc** — browser (level 2) vẫn giữ bản cũ
   độc lập, 2 tầng phải invalidate riêng.

---

# Quyết định đã chốt

1. Cold cache toàn hệ thống: không tách scenario riêng, ghi chú gộp ở mục 10
   (đã thêm).
2. ShopHub: SSR/SSG (Next.js ISR-style) — đã cập nhật mục 3 (CDN cache HTML
   rendered) và mục 4 (LB cache full page).
3. Redis multi-instance: giữ mức mô tả hiện tại ở mục 5 (Pub/Sub invalidate),
   không đào sâu topology — nếu build flow3d deck thật thì bổ sung lúc viết
   model của scenario đó.
4. Flow3d deck (`ecommerce-cache-flow-3d/ecommerce-cache-flow-3d.html`) built
   and delivered — 4 scenarios: read path, write path, cold cache, build cache.
   Latency numbers are illustrative/invented and explicitly labeled as such
   within the deck (not production benchmarks).
