# Phase 7B — Persist one gift command

[Previous: 7A](phase-07a-retry-a-coin-gift.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 7C](phase-07c-deduplicate-ledger-consumption.md)

## Intent

Bind retries của cùng internal coin gift vào một durable operation/command trước
khi message đi tới ledger consumer.

## Starting state

Naive handler đã tạo hai transfer effect cho một user intent.

Replay `scope: hero-room` · `workloadId: hero-donation-retry`; chỉ đổi
`architecture.financial: naive → idempotent-command`.

`architecture: media=shielded · interaction=split-plane · financial=idempotent-command · fleetPolicy=transcode-all`

`plane verdicts: media=PASS · interaction=PASS · financial=FAIL (ledger consumption not protected yet) · fleet=UNTESTED`

`invariant flips:`

```text
commandsPerIntent = 1          FAIL → PASS
ledgerEffectsPerIntent = 1     FAIL → FAIL   (chuyển sang Phase 7C)
```

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 24.100/h · worst plane FAIL`

## Single action

Giới thiệu hai thứ client chưa từng gửi ở 7A: một scoped `idempotencyKey` và một
request fingerprint gồm `viewer`, `room`, `giftType`, `coinAmount`. Server dùng
chúng để atomically persist `Operation + Command Outbox`.

## Choreography

Key là cái cho phép server nhận ra hai attempt là một ý định. Fingerprint là cái
ngăn client tái sử dụng key cho một request khác.

Attempt A tạo operation `PENDING` và Command Outbox trong cùng transaction.
Attempt B cùng key/fingerprint đọc lại cùng operation, không tạo command thứ hai.
Cùng key nhưng fingerprint khác trả `CONFLICT`. Retry khi operation còn
`PENDING` trả cùng operation/status, không giả đã có committed result.

## Panel message

API idempotency làm `2 attempts → 1 command`. Nó chưa chứng minh queue delivery
hoặc ledger effect chỉ xảy ra một lần; claim đó thuộc Phase 7C.

## HUD

`Changed: naive request handling → atomic Operation + Command Outbox` ·
`Boundary: commands per scoped intent = 1` ·
`Result: 2 attempts → 1 command; financial vẫn FAIL ở tầng consumption`

```text
attempt A   key K + fingerprint F   → operation PENDING, command #1
attempt B   key K + fingerprint F   → cùng operation, không tạo command
attempt C   key K + fingerprint F'  → CONFLICT

commands    1
ledger effects  chưa được bảo vệ    → Phase 7C
```

## Replay and takeaway

Fix phase mặc định mở split-screen ghost: cùng camera, cùng lost-response retry,
cột trái 7A, cột phải 7B. Takeaway tự xuất hiện: same key/fingerprint trả
cùng operation; same key/different payload là conflict. Không có prompt.

## End state and acceptance

- Operation state thuộc `PENDING | COMMITTED | REJECTED`.
- Operation và Command Outbox atomic; không có operation mà thiếu command hoặc
  command không có operation.
- Ledger seal chưa xuất hiện; phase không claim exactly-once business effect.
- `idempotencyKey` và fingerprint xuất hiện **lần đầu** ở đây; nếu chúng đã có
  mặt ở 7A thì reveal của phase này mất hiệu lực.
- Financial Core là region riêng, token có operation ID/fingerprint.
