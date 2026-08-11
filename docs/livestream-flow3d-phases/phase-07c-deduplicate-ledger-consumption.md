# Phase 7C — Commit one ledger effect

[Previous: 7B](phase-07b-bind-gift-to-operation.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 7D](phase-07d-publish-committed-result.md)

## Intent

Cho phép queue redeliver nhưng commit đúng một balanced Ledger effect trong
modeled ledger boundary.

## Starting state

Một durable operation/command đã tồn tại; queue dùng at-least-once delivery.

Replay `scope: hero-room` · `workloadId: hero-donation-retry`; chỉ đổi
`architecture.financial: idempotent-command → ledger-safe`.

`architecture: media=shielded · interaction=split-plane · financial=ledger-safe · fleetPolicy=transcode-all`

`plane verdicts after replay: media=PASS · interaction=PASS · financial=FAIL until committed read model · fleet=UNTESTED`

`invariant flips:`

```text
ledgerEffectsPerIntent = 1     FAIL → PASS
clientSeesCommittedResult      FAIL → FAIL   (chuyển sang Phase 7D)
```

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 24.100/h · worst plane FAIL`

## Single action

Deliver cùng command hai lần vào consumer transaction.

## Choreography

Hai money token giữ cùng operation ID và khác attempt number. Delivery đầu
atomically ghi `Inbox operationId UNIQUE + balanced Ledger debit/credit +
Committed Result Outbox`. Delivery lặp gặp Inbox uniqueness, ACK/no-op và không
tạo seal mới. Signature moment: `2 deliveries → 1 immutable ledger seal`.

```text
delivery #1   inbox insert OK    → debit 500 / credit 500   seal #1
delivery #2   inbox conflict     → no-op, ACK               không có seal

ledger        500 coin đã chuyển   (7A: 1.000)
```

Ledger unavailable làm transaction fail closed: operation không thành
`COMMITTED` và không có success notification.

## Panel message

Đây là exactly-once business effect trong ledger boundary đã model, không phải
exactly-once delivery. Queue vẫn được phép giao hai lần.

## HUD

`Changed: consumer without dedup → atomic Inbox + Ledger + Result Outbox` ·
`Boundary: committed transfer effects per operation = 1` ·
`Result: ledger invariant PASS; financial plane incomplete until 7D`

`View evidence`: balanced entries, duplicate no-op và transaction failure path.

## Replay and takeaway

Fix phase mặc định mở split-screen ghost với cùng hai deliveries, cột trái 7B,
cột phải 7C. Takeaway tự xuất hiện: uniqueness chỉ có ý nghĩa
khi Inbox, Ledger và committed-result outbox nằm cùng atomic boundary.

## End state and acceptance

- Hai deliveries visible; chỉ một ledger seal.
- Balanced debit/credit và Inbox uniqueness commit cùng transaction.
- Exactly-once claim bị scope vào modeled ledger boundary.
- Reconciliation là secondary semantic path, không phải bằng chứng commit.
