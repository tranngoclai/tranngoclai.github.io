# Phase 7A — Retry an internal coin gift

[Previous: 6C](phase-06c-bound-viewer-presentation.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 7B](phase-07b-bind-gift-to-operation.md)

## Intent

Làm lộ duplicate internal coin-transfer effect khi client retry một gift sau khi
commit đầu tiên thành công nhưng response bị mất.

## Starting state

Comment/like đã được tối ưu như best-effort traffic; internal coin/gift handler
vẫn naive và chưa enforce idempotency trên ledger path.

`scope: hero-room` · `workloadId: hero-donation-retry`

`architecture: media=shielded · interaction=split-plane · financial=naive · fleetPolicy=transcode-all`

`plane verdicts after pressure: media=PASS · interaction=PASS · financial=FAIL · fleet=UNTESTED`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 24.100/h · worst plane FAIL`

## Single action

Vặn núm **retry**: Viewer gửi một gift `500 coin`. Handler commit debit/credit
xong thì response rớt trên đường về. Client không nhận được gì nên tự gửi lại
đúng request đó.

## Choreography

Hai attempt mang cùng nội dung — `viewer`, `room`, `giftType`, `coinAmount` —
nhưng handler không có cách nào biết chúng là một ý định duy nhất. Nó xử lý
attempt B như một request mới:

```text
attempt A   debit 500 → credit 500   COMMITTED   response mất
attempt B   debit 500 → credit 500   COMMITTED   response về tới client

ledger      1.000 coin đã chuyển
user intent   500 coin
```

UI gift effect có thể pulse hai lần nhưng được vẽ ở lane riêng vì UI không phải
bằng chứng ledger đã commit.

## Panel message

Money event không được sample hoặc “đếm gần đúng”. Retry là bình thường khi
response mất sau commit và client không biết kết quả; issue ở đây là internal
coin transfer, không ngầm khẳng định đã charge một payment card hai lần.

## HUD

`Changed: response dropped after first commit → retry same operation intent` ·
`Boundary: 1 user intent phải commit <= 1 transfer effect` ·
`Result: financial FAIL — 2 effects, 1.000 coin cho ý định 500 coin`

`View evidence`: attempts, request payload và commit timeline. Chưa có
mechanism nào để nối hai attempt lại với nhau — đó chính là cái thiếu.

## Learning checkpoint

**Predict:** retry xảy ra trước hay sau commit đầu tiên. Rationale chỉ ra
response mất *sau* khi ledger đã ghi, nên client và server bất đồng về việc gì
đã xảy ra — và không bên nào sai. Breach tự highlight; không gate
Apply fix.

## End state and acceptance

- Commit đầu tiên và lost response trước retry hiện rõ trên timeline.
- Hai attempt mang cùng payload nhưng **không** mang idempotency key hay
  operation ID — mọi mechanism chống trùng phải xuất hiện lần đầu ở Phase 7B,
  không được lộ ở phase issue.
- Ledger model thể hiện hai debit/credit effects cho đúng một user intent, kèm
  con số coin cụ thể.
- Không khẳng định UI effect là bằng chứng ledger đã commit.
- Durable fix chưa xuất hiện trong phase issue.
