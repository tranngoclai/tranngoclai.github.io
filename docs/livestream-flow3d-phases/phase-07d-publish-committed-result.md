# Phase 7D — Publish committed result

[Previous: 7C](phase-07c-deduplicate-ledger-consumption.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 8A](phase-08a-add-cold-rooms.md)

## Intent

Publish authoritative committed read model rồi tách post-commit UI notification
khỏi ledger truth.

## Starting state

Ledger đã commit một effect và Committed Result Outbox tồn tại.

`scope: hero-room` · `workloadId: hero-donation-retry`

`architecture delta: financial=ledger-safe → money-safe`

`architecture: media=shielded · interaction=split-plane · financial=money-safe · fleetPolicy=transcode-all`

`plane verdicts: media=PASS · interaction=PASS · financial=PASS · fleet=UNTESTED`

`invariant flip: clientSeesCommittedResult FAIL → PASS`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 24.100/h · worst plane UNTESTED (fleet)`

## Single action

Project committed result sang Operation/Read Model.

## Choreography

Result Outbox cập nhật operation `PENDING → COMMITTED` và committed read model.
Sau đó notification mang operation/effect ID đi qua presentation transport có
thể best-effort hoặc at-least-once; client deduplicate UI pulse. Mất/lặp pulse
không tạo hoặc xóa Ledger seal. Reconciliation link vẫn visible như secondary
detail.

## Panel message

Committed read model là bằng chứng cho UI success. UI effect không phải bằng
chứng settlement và không nằm trong atomic ledger transaction.

## HUD

`Changed: committed result → read model + notification` ·
`Boundary: UI state derives from COMMITTED operation` ·
`Result: financial FAIL → PASS at committed read model; remains PASS if notification is lost/duplicated`

## Replay and chapter recap

Fix phase mặc định mở split-screen ghost, replay hai notification outcomes
(nhận được / mất) với cùng một Ledger state — cả hai đều giữ `500 coin`.

**Chapter recap — Interactive & correct:** chọn explanation phân biệt bounded
metadata presentation với authoritative money command/Ledger boundary.

## End state and acceptance

- Read model có operation state `COMMITTED`; `REJECTED` không phát success.
- Notification có operation/effect ID; duplicate UI pulse được dedup nếu client
  hỗ trợ, nhưng UI exactly-once không thuộc ledger invariant.
- Financial invariant không claim redundancy, regional failover, data residency
  hoặc recovery behavior; các gap overall đóng ở 8C.
