# Facebook Sales Intelligence — Commercialization Task List

## Owned Page MVP progress — 2026-09-28

Đã hoàn thành và có automated verification trong source hiện tại:

- [x] Page import + owned Page post/comment sync vào SQLite.
- [x] Bounded pagination và retry/backoff cho Graph API client.
- [x] Duplicate-safe post/comment/lead persistence.
- [x] Sync job SUCCESS/FAILED persistence và recovery job RUNNING khi app restart.
- [x] Local Vietnamese lead detector, negative filters và scoring.
- [x] Posts/Comments UI dùng dữ liệu thật với search/filter/pagination.
- [x] Lead Inbox: filter, status update, notes, tags và source link.
- [x] CSV UTF-8 export theo filter; không xuất raw JSON/token; có formula-injection guard.
- [x] Báo cáo all-time: status counts, Won/conversion và top posts.
- [x] CSP + controlled external-link handler + typed IPC validation.
- [x] Migration compatibility test cho các cột Owned Page MVP mới.

Chưa được coi là hoàn tất: production OAuth/App Review, backup/restore, scheduler cancel/resume, bulk lead actions/history, XLSX, date-range analytics, installer/signing/update/license và closed beta. Live Meta end-to-end vẫn cần token/quyền hợp lệ trên máy người dùng.

## Phase A — Productize nền móng

### Task 1 — Định nghĩa production Meta connection contract

**Description:** Thay thiết kế development-token bằng flow OAuth production và xác định rõ token lifecycle, permission, reconnect/error states trước khi viết UI mới.

**Acceptance criteria:**
- [ ] Có typed service contract cho connect/status/disconnect/reconnect.
- [ ] Renderer không nhận raw access token.
- [ ] Có state rõ cho connected, expired, revoked, permission-missing và error.

**Verification:**
- [ ] Unit tests cho state/error mapping.
- [ ] `npm run typecheck` pass.
- [ ] Review contract trước khi triển khai UI.

**Dependencies:** None

**Estimated scope:** Medium

### Task 2 — Xây onboarding kết nối Page

**Description:** Tạo flow chào mừng → kết nối Meta → chọn Page → bắt đầu sync, dành cho người không kỹ thuật.

**Acceptance criteria:**
- [ ] Không còn yêu cầu người dùng nhập development access token.
- [ ] Có retry và hướng dẫn lỗi bằng tiếng Việt.
- [ ] Người dùng có thể bỏ qua và quay lại kết nối sau.

**Verification:**
- [ ] Component tests cho các bước chính.
- [ ] Manual happy-path và expired/revoked-path.
- [ ] `npm run build` pass.

**Dependencies:** Task 1

**Estimated scope:** Medium

### Task 3 — Chuẩn hóa database migration và backup/restore

**Description:** Chuyển DB setup thành migration có version, thêm backup/restore trước khi dữ liệu thật tăng lên.

**Acceptance criteria:**
- [x] DB mới và DB cũ đều nâng cấp được cho schema Owned Page MVP hiện tại.
- [ ] Backup tạo bản sao nhất quán khi app đang chạy.
- [ ] Restore có validation/version check và không ghi đè im lặng.

**Verification:**
- [x] Migration tests trên fixture DB cũ.
- [ ] Backup → mutate → restore round-trip test.
- [ ] Database health check pass sau restore.

**Dependencies:** None

**Estimated scope:** Medium

### Checkpoint A

- [x] Tests/typecheck/lint/build pass cho source hiện tại.
- [ ] Người dùng mới có thể cài app và kết nối Page mà không cần kiến thức developer token.
- [ ] Database có migration + backup path an toàn.

## Phase B — Sync Posts và Comments

### Task 4 — Implement Posts vertical slice

**Description:** Đồng bộ post theo Page với repository, service, IPC và màn hình Posts có pagination/filter cơ bản.

**Acceptance criteria:**
- [x] Sync post từ Page đã chọn và upsert theo Facebook Post ID.
- [x] UI hiển thị dữ liệu thật, không còn placeholder.
- [x] Có incremental time marker và last synced state; hiện dùng overlap 7 ngày.

**Verification:**
- [x] Unit tests repository/service.
- [x] Fixture test pagination + duplicate upsert.
- [ ] Manual sync Page nhỏ.

**Dependencies:** Task 1, Task 3

**Estimated scope:** Medium

### Task 5 — Implement Comments vertical slice

**Description:** Đồng bộ comment/reply theo post, lưu quan hệ và hiển thị danh sách có search/filter/pagination.

**Acceptance criteria:**
- [x] Upsert comment theo Facebook Comment ID.
- [x] Không tạo trùng khi sync lại.
- [x] UI hiển thị Page/Post/time/author/message và link nguồn khi có.

**Verification:**
- [x] Unit tests repository/service.
- [ ] Fixture test comment pagination/replies.
- [ ] Manual resync xác nhận không nhân bản dữ liệu.

**Dependencies:** Task 4

**Estimated scope:** Medium

### Task 6 — Biến sync_jobs thành scheduler thực tế

**Description:** Tách orchestration đồng bộ khỏi UI, hỗ trợ progress, retry/backoff, cancel và resume.

**Acceptance criteria:**
- [ ] Job state luôn kết thúc ở success/failed/cancelled hợp lệ.
- [x] Lỗi mạng tạm thời retry hữu hạn; lỗi permission không retry vô hạn.
- [x] Restart app không làm mất khả năng nhận biết job dở dang; RUNNING được recovery thành FAILED/APP_RESTARTED.

**Verification:**
- [x] Tests state transition cho SUCCESS/FAILED/recovery hiện có.
- [ ] Tests simulated timeout/rate-limit/revoked token.
- [ ] Manual cancel/resume.

**Dependencies:** Task 4, Task 5

**Estimated scope:** Medium

### Checkpoint B

- [x] Sync nhiều lần không tạo duplicate ở persistence layer.
- [ ] Mất mạng giữa chừng không phá DB.
- [x] Posts/Comments UI đã dùng dữ liệu thật.

## Phase C — Lead Inbox tạo giá trị thương mại

### Task 7 — Local rule engine và preset tiếng Việt

**Description:** Phát hiện intent mua hàng không cần AI bằng keyword/pattern/rule có thể cấu hình.

**Acceptance criteria:**
- [ ] Có preset cho bán hàng và dịch vụ.
- [x] Rule hiện có positive/negative patterns và trọng số.
- [x] Chạy lại rule không tạo lead trùng nhờ unique source comment + upsert.

**Verification:**
- [x] Dataset fixture positive/negative.
- [ ] Precision sanity check trên sample comment.
- [x] Unit tests scoring/dedupe.

**Dependencies:** Task 5

**Estimated scope:** Medium

### Task 8 — Lead repository + Lead Inbox

**Description:** Biến bảng leads thành workflow làm việc thực tế.

**Acceptance criteria:**
- [ ] Search/filter/sort theo Page/status/score/time.
- [x] Đổi status New/Contacted/Qualified/Won/Lost.
- [x] Mở được post nguồn qua controlled external-link handler.

**Verification:**
- [x] Repository/service tests.
- [ ] UI tests cho filter/status update.
- [ ] Manual end-to-end comment → lead → Won.

**Dependencies:** Task 7

**Estimated scope:** Medium

### Task 9 — Notes, tags và bulk actions

**Description:** Bổ sung thông tin làm việc tối thiểu để người dùng quản lý nhiều lead.

**Acceptance criteria:**
- [x] Add/edit note và tag.
- [ ] Bulk status/tag cho nhiều lead.
- [ ] Lịch sử cập nhật tối thiểu được lưu.

**Verification:**
- [ ] Persistence tests.
- [ ] Manual restart app vẫn giữ dữ liệu.

**Dependencies:** Task 8

**Estimated scope:** Medium

### Task 10 — Export CSV/XLSX

**Description:** Xuất lead theo bộ lọc hiện tại với encoding tiếng Việt đúng.

**Acceptance criteria:**
- [ ] CSV mở đúng UTF-8 trong Excel phổ biến.
- [ ] XLSX có cột rõ ràng và dữ liệu đúng filter.
- [x] Không tự xuất token/raw JSON nhạy cảm; CSV có formula-injection guard.

**Verification:**
- [x] Export fixture test.
- [ ] Manual open file trong Excel.

**Dependencies:** Task 8

**Estimated scope:** Small/Medium

### Checkpoint C — MVP value loop

- [ ] Sync comment → detect lead → review → update status → export chạy end-to-end.
- [x] Core workflow hoạt động khi AI hoàn toàn tắt.
- [ ] Đây là mốc bắt đầu pilot với người dùng thật.

## Phase D — Commercial distribution

### Task 11 — Windows packaging và installer

**Description:** Bổ sung pipeline đóng gói app Windows thay vì chỉ electron-vite build.

**Acceptance criteria:**
- [ ] Cài/gỡ app không cần Node/npm.
- [ ] User data không bị xóa khi update thông thường.
- [ ] Có version metadata và release artifact rõ ràng.

**Verification:**
- [ ] Clean Windows install test.
- [ ] Upgrade previous build test.
- [ ] Uninstall behavior test.

**Dependencies:** Checkpoint C

**Estimated scope:** Medium

### Task 12 — License/activation service

**Description:** Thêm account/license entitlement tối thiểu cho trial và gói trả phí.

**Acceptance criteria:**
- [ ] Activate/deactivate device.
- [ ] Grace period hợp lý khi backend tạm thời offline.
- [ ] Hết trial không làm mất dữ liệu local.

**Verification:**
- [ ] License state tests.
- [ ] Offline/grace-period manual test.

**Dependencies:** Task 11

**Estimated scope:** Medium

### Task 13 — Auto-update + code signing

**Description:** Tạo update channel an toàn và giảm cảnh báo SmartScreen bằng signing phù hợp.

**Acceptance criteria:**
- [ ] App kiểm tra update và tải bản hợp lệ.
- [ ] Update failure không làm hỏng bản đang chạy.
- [ ] Release artifact có signature/verifiable integrity.

**Verification:**
- [ ] Upgrade test từ N-1 → N.
- [ ] Corrupt update is rejected.

**Dependencies:** Task 11

**Estimated scope:** Medium

### Checkpoint D

- [ ] Có installer, trial/license và update path.
- [ ] Có thể phát bản beta cho khách thật mà không cần môi trường dev.

## Phase E — AI + Analytics

### Task 14 — AI provider abstraction và quota

**Description:** Tạo lớp provider, queue và quota độc lập với UI.

**Acceptance criteria:**
- [ ] Provider có interface ổn định.
- [ ] Rule prefilter trước AI.
- [ ] Cache analysis theo entity/version để tránh gọi lại không cần thiết.

**Verification:**
- [ ] Mock-provider tests.
- [ ] Quota/retry/failure tests.
- [ ] AI disabled path pass toàn bộ core workflow.

**Dependencies:** Task 7, Task 12

**Estimated scope:** Medium

### Task 15 — AI enrichment UI

**Description:** Hiển thị buyer intent, summary, pain point, interest, question, sentiment và confidence theo cách dễ hiểu.

**Acceptance criteria:**
- [ ] Lead vẫn đọc được khi chưa có AI result.
- [ ] Có loading/error state riêng từng lead/batch.
- [ ] Có feedback/correction action.

**Verification:**
- [ ] UI tests loading/success/error.
- [ ] Manual compare AI on/off.

**Dependencies:** Task 14

**Estimated scope:** Medium

### Task 16 — Analytics và Reports

**Description:** Thay placeholder Insights/Reports bằng dashboard tập trung vào funnel và nguồn lead.

**Acceptance criteria:**
- [ ] Funnel theo khoảng thời gian.
- [x] Top Post theo số lead và Won; reports hiện là all-time.
- [ ] Filter nhất quán với Lead Inbox.

**Verification:**
- [x] Query tests trên fixture dataset.
- [ ] Cross-check totals với Lead Inbox.

**Dependencies:** Task 8

**Estimated scope:** Medium

### Checkpoint E

- [x] AI không phải dependency của core; Owned Page MVP dùng local rule engine.
- [ ] Analytics khớp dữ liệu lead thực tế.

## Phase F — Hardening và launch

### Task 17 — Security hardening desktop

**Description:** Rà soát Electron/browser boundary, CSP, external navigation, logging, secret/PII handling và update channel.

**Acceptance criteria:**
- [x] CSP rõ ràng và chỉ cho phép nguồn cần thiết.
- [x] External links mở qua controlled handler với HTTP/HTTPS validation.
- [ ] Logs/diagnostics redact token và PII nhạy cảm.

**Verification:**
- [ ] Security review checklist.
- [ ] Negative tests IPC validation.

**Dependencies:** Task 11, Task 13

**Estimated scope:** Medium

### Task 18 — Observability + diagnostic bundle

**Description:** Thêm structured logs, sync diagnostics, crash context và export bundle cho support.

**Acceptance criteria:**
- [ ] User có thể xuất diagnostic bundle từ Settings.
- [ ] Bundle không chứa access token.
- [ ] Sync failures có code/context đủ để support.

**Verification:**
- [ ] Redaction tests.
- [ ] Manual failure reproduction → diagnostic bundle.

**Dependencies:** Task 6

**Estimated scope:** Medium

### Task 19 — End-to-end regression suite

**Description:** Bảo vệ các workflow thương mại quan trọng trước release.

**Acceptance criteria:**
- [ ] Onboarding/connect flow covered.
- [ ] Sync → lead → status → export covered.
- [ ] Migration/backup/restore covered.

**Verification:**
- [ ] Suite chạy ổn định nhiều lần.
- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass (2026-09-28).

**Dependencies:** Tasks 2–18 relevant slices

**Estimated scope:** Medium

### Task 20 — Closed beta launch

**Description:** Phát bản beta cho nhóm nhỏ và đo activation/value trước khi mở bán rộng.

**Acceptance criteria:**
- [ ] Theo dõi connect success, time-to-first-lead, sync failure, weekly return và export usage.
- [ ] Có kênh feedback/support rõ ràng.
- [ ] P0/P1 beta issues được đóng trước public release.

**Verification:**
- [ ] Beta release checklist hoàn tất.
- [ ] Có báo cáo kết quả pilot và quyết định scope public release.

**Dependencies:** Checkpoints C, D; Tasks 17–19

**Estimated scope:** Medium

## Definition of Done cho mọi task

- [ ] Acceptance criteria đạt.
- [ ] Test tập trung pass.
- [ ] `npm run lint` pass.
- [ ] `npm run build` pass.
- [ ] Không log token/secret.
- [ ] Error state có thông báo tiếng Việt dễ hiểu ở UI nếu user-visible.
- [ ] Không làm core app phụ thuộc AI.
- [ ] Không tải list lớn không giới hạn lên renderer.
