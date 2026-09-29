# Facebook Sales Intelligence — Commercialization Task List

## Meta Developer Mode (Local-First Dev Token Testing) — 2026-09-28

- [x] Task DEV-1: Khai báo IPC channel, Zod schema, types và mã lỗi tiếng Việt cho Developer Mode.
- [x] Task DEV-2: Triển khai `MetaService.setDeveloperToken` với xác thực `/me`, permissions và lưu `safeStorage`.
- [x] Task DEV-3: Đăng ký typed IPC handler có kiểm tra môi trường dev và cấu hình preload API có điều kiện.
- [x] Task DEV-4: Xây giao diện Meta Developer Mode trong Settings (chỉ hiển thị ở development).
- [x] Task DEV-5: Viết bộ unit/integration test cho service, IPC, storage và xác minh production mode không expose manual-token API.
- [x] Checkpoint: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass.
- [x] Task DEV-6: Hướng dẫn và kiểm thử E2E local bằng Meta Graph API giả lập (Token -> kết nối -> chọn Page -> import -> sync -> Comments -> Lead detection -> Lead Inbox).
- [ ] Manual E2E với Meta Page và token thật; chưa có Page/token hợp lệ để xác minh.

## Production OAuth + onboarding implementation — 2026-09-28

Đã có trong source: OAuth broker mẫu, system-browser/loopback handoff có state và verifier,
credential store `safeStorage`, permission check, typed IPC, Settings không nhập token,
onboarding 4 bước, resume bước đồng bộ, và test cho callback/handoff/token/status.

Chưa thể đánh dấu production-ready: chưa có Meta App ID, App Secret trên server, HTTPS domain,
Meta App Review/Advanced Access, hoặc live end-to-end với Page thật. Cần cấu hình theo
`docs/meta-oauth.md` và xác minh yêu cầu Meta hiện hành trước khi phát hành.

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

Chưa được coi là hoàn tất: production OAuth/App Review, backup/restore, date-range analytics, installer/signing/update/license và closed beta. Live Meta end-to-end vẫn cần token/quyền hợp lệ trên máy người dùng.

## Local sync reliability & Lead Inbox Enhancements — 2026-09-29

- [x] Quét lại comment trên mọi post đã lưu, kể cả post ngoài cửa sổ incremental 7 ngày; không quét trùng post mới trong cùng lượt.
- [x] Hủy đồng bộ qua Pages/IPC, job chuyển CANCELLED và có thể chạy lại với upsert chống trùng.
- [x] Vượt giới hạn phân trang trả lỗi, không đánh dấu sync hoàn tất.
- [x] Tests cho post cũ, lỗi giữa chừng/chạy lại, hủy, trạng thái job và phân trang.
- [x] Progress chi tiết theo thời gian thực: streaming qua IPC channel `META_SYNC_PROGRESS`, hiển thị tiến độ và trạng thái trực quan trong giao diện Pages.
- [x] Checkpoint bền vững ở cấp bài viết: lưu ID bài đã hoàn tất, stage, metrics và mốc `since`; sau lỗi, hủy hoặc restart, tải lại danh sách bài và bỏ qua các bài đã hoàn tất.
- [ ] Resume theo cursor phân trang Meta: cột `cursor` hiện chưa được sử dụng; danh sách bài viết và bình luận của một bài vẫn được tải lại từ đầu khi tiếp tục.
- [x] Lead Inbox Bulk Actions: Chọn nhiều lead, chọn tất cả trên trang, đổi trạng thái hàng loạt, thêm tags hàng loạt qua IPC handlers chuyên dụng.
- [x] Lead Change History: Bảng `lead_history` lưu vết thay đổi trạng thái, ghi chú, nhãn với timeline trực quan trên giao diện Lead Inbox.
- [x] Xuất dữ liệu Lead Inbox hoàn thiện: Hỗ trợ Excel Workbook (.xlsx) mở trực tiếp trong Excel hiển thị đúng 100% tiếng Việt Unicode và 12 cột riêng biệt, lẫn CSV (.csv) chuẩn RFC 4180 có UTF-8 BOM; chống formula injection; tên gợi ý theo mili-giây không trùng; xử lý an toàn và báo lỗi rõ ràng khi tệp bị khóa (EBUSY/EPERM).
- [x] Đầy đủ unit/integration tests cho checkpoint repository, bulk lead mutations, lead history, sync resumption, IPC handlers, XLSX/CSV export và UI components (25 test suites, 89 tests pass 100%).
- [ ] Manual test / Live E2E với Meta Page và token thật trên môi trường thực tế của người dùng (chưa đánh dấu hoàn tất vì chưa có Page/token thật).

## Phase A — Productize nền móng

### Task 1 — Định nghĩa production Meta connection contract

**Description:** Thay thiết kế development-token bằng contract production OAuth có state machine rõ ràng. Đây là foundation cho mọi bước phía sau và phải giữ raw token/App Secret ngoài renderer.

**Acceptance criteria:**
- [ ] Có typed state `disconnected | connecting | connected | expired | revoked | permission_missing | error` và service contract `connect/status/reconnect/disconnect`.
- [ ] Renderer chỉ nhận trạng thái/metadata an toàn; không nhận raw access token, App Secret hoặc OAuth code.
- [ ] Required permissions được khai báo tập trung: `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`.

**Verification:**
- [ ] Unit tests cho state/error/permission mapping.
- [ ] `npm run typecheck` pass.
- [ ] Review contract trước khi triển khai UI.

**Dependencies:** None

**Files likely touched:**
- `src/shared/schemas/ipc.ts`
- `src/shared/types/ipc.ts`
- `src/shared/constants/ipc.ts`
- `src/main/meta/meta.errors.ts`
- `src/main/meta/meta.service.ts`

**Estimated scope:** Medium

### Task 1.1 — Secure credential store + retire development token

**Description:** Chuyển `token.service.ts` từ file development token sang credential store trung tính dùng `safeStorage`; file cũ không cấp quyền production và được dọn sau khi credential mới lưu thành công.

**Acceptance criteria:**
- [ ] Credential production được mã hóa bằng `safeStorage` và không lưu trong SQLite/log.
- [ ] Development token cũ không còn là input của production flow; file cũ chỉ bị xóa sau khi migration/cleanup thành công.
- [ ] Corrupt/unreadable credential trả state an toàn và không crash app.

**Verification:**
- [ ] Unit tests save/read/delete/corrupt/migration.
- [ ] Restart app vẫn đọc được trạng thái kết nối.
- [ ] `npm run typecheck` pass.

**Dependencies:** Task 1

**Files likely touched:**
- `src/main/meta/token.service.ts`
- `src/main/meta/meta.service.ts`
- `src/main/meta/meta.service.test.ts`

**Estimated scope:** Medium

### Task 1.2 — OAuth broker + callback handoff

**Description:** Tạo production OAuth flow qua system browser và backend broker để Electron không chứa App Secret. Broker xử lý callback/token exchange và trả one-time handoff cho main process.

**Acceptance criteria:**
- [ ] `connect()` mở login flow ngoài renderer và tạo `state` chống CSRF/replay có expiry.
- [ ] Callback/handoff chỉ dùng một lần; token exchange cần secret chỉ chạy ở backend.
- [ ] Cancel, timeout và callback sai state được map thành lỗi rõ ràng.

**Verification:**
- [ ] Unit/integration tests state, expiry, replay, cancel và malformed callback.
- [ ] Manual dev flow với Meta test user/app role.
- [ ] Không có App Secret trong bundle Electron.

**Dependencies:** Task 1, Task 1.1

**Files likely touched:**
- `src/main/meta/oauth.service.ts` (mới)
- `src/main/meta/meta.service.ts`
- `src/main/index.ts`
- backend OAuth broker tương ứng

**Estimated scope:** Medium

### Task 1.3 — Permission validation + reconnect lifecycle

**Description:** Sau OAuth, xác minh identity/permissions và chuyển các lỗi expired, revoked, thiếu quyền thành connection state có thể phục hồi.

**Acceptance criteria:**
- [ ] Kết nối chỉ được coi là ready khi đủ ba permission MVP và gọi Graph API kiểm tra thành công.
- [ ] Expired/revoked/permission-missing có state + thông điệp tiếng Việt riêng.
- [ ] `reconnect()` không xóa dữ liệu Page/Post/Comment/Lead local.

**Verification:**
- [ ] Tests cho permission matrix và Graph error mapping.
- [ ] Manual revoke permission -> app hiển thị reconnect đúng.
- [ ] `npm test` và `npm run typecheck` pass.

**Dependencies:** Task 1.2

**Files likely touched:**
- `src/main/meta/meta.client.ts`
- `src/main/meta/meta.errors.ts`
- `src/main/meta/meta.service.ts`

**Estimated scope:** Medium

### Checkpoint OAuth Foundation

- [ ] Connect/reconnect/disconnect chạy qua typed IPC.
- [ ] Renderer/log/SQLite không chứa raw token hoặc App Secret.
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass.

### Task 2 — Xây onboarding kết nối Page

**Description:** Tạo onboarding 4 bước cho người dùng Việt Nam: Chào mừng -> Kết nối Meta -> Chọn Page -> Đồng bộ lần đầu, tái sử dụng Page import/sync hiện có.

**Acceptance criteria:**
- [ ] Không còn yêu cầu người dùng nhập development access token.
- [ ] Có retry và hướng dẫn lỗi bằng tiếng Việt.
- [ ] Người dùng có thể bỏ qua và quay lại kết nối sau.

**Verification:**
- [ ] Component tests cho các bước chính.
- [ ] Manual happy-path và expired/revoked-path.
- [ ] `npm run build` pass.

**Dependencies:** Task 1

**Files likely touched:**
- `src/renderer/src/pages/Onboarding.tsx`
- `src/renderer/src/App.tsx`
- `src/renderer/src/pages/Settings.tsx`
- `src/renderer/src/pages/Pages.tsx`
- `src/preload/api.ts`
- `src/main/ipc/meta.ipc.ts`

**Estimated scope:** Medium

### Task 2.1 — Production Settings connection UI

**Description:** Bỏ development token field khỏi Settings và thay bằng connection status, quyền, reconnect/disconnect actions.

**Acceptance criteria:**
- [ ] Settings không còn chữ/input Development Access Token.
- [ ] Connected/expired/revoked/permission-missing hiển thị bằng tiếng Việt và có action phù hợp.
- [ ] Disconnect có xác nhận nhưng không xóa dữ liệu local.

**Verification:**
- [ ] Component tests cho các connection states.
- [ ] Keyboard/focus states hoạt động.
- [ ] `npm run build` pass.

**Dependencies:** Checkpoint OAuth Foundation

**Files likely touched:**
- `src/renderer/src/pages/Settings.tsx`
- `src/renderer/src/components/StatusBadge.tsx`

**Estimated scope:** Small/Medium

### Task 2.2 — Onboarding shell + resume state

**Description:** Thêm route/shell onboarding và lưu progress tối thiểu để user có thể bỏ qua hoặc tiếp tục sau.

**Acceptance criteria:**
- [ ] 4 bước rõ ràng, không yêu cầu kiến thức developer/API.
- [ ] Skip đưa user vào app và Settings có CTA quay lại onboarding.
- [ ] Restart app không làm mất trạng thái đã connect/import Page.

**Verification:**
- [ ] Component/navigation tests.
- [ ] Manual fresh install state và resume state.
- [ ] `npm run typecheck` pass.

**Dependencies:** Task 2.1

**Files likely touched:**
- `src/renderer/src/pages/Onboarding.tsx`
- `src/renderer/src/App.tsx`
- local preference/state helper nếu cần

**Estimated scope:** Medium

### Task 2.3 — Page selection + first sync vertical slice

**Description:** Nhúng `getAccessiblePages -> importPage -> syncPage` vào onboarding, dùng đúng service hiện có để tránh tạo pipeline song song.

**Acceptance criteria:**
- [ ] User thấy danh sách Page đã cấp quyền và chọn ít nhất một Page.
- [ ] Import Page chống trùng và onboarding chuyển sang first sync bằng service hiện tại.
- [ ] Sync success đưa user vào Dashboard/Leads; sync failure có retry mà không mất Page đã import.

**Verification:**
- [ ] Component/service tests cho select/import/sync transitions.
- [ ] Manual login -> select Page -> sync -> thấy dữ liệu local.
- [ ] Re-run onboarding không tạo duplicate Page/Post/Comment.

**Dependencies:** Task 2.2, Task 1.3

**Files likely touched:**
- `src/renderer/src/pages/Onboarding.tsx`
- `src/renderer/src/pages/Pages.tsx`
- `src/main/ipc/meta.ipc.ts`
- existing sync service/tests

**Estimated scope:** Medium

### Task 2.4 — App Review + production readiness evidence

**Description:** Chuẩn bị đầy đủ artefact để xin quyền Meta production và kiểm tra live-mode flow trước pilot.

**Acceptance criteria:**
- [ ] Có permission use-case text cho `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`.
- [ ] Có screencast login -> Page selection -> đọc post/comment -> lead workflow.
- [ ] Privacy policy, data deletion instructions, test user/role và compliance checklist sẵn sàng.

**Verification:**
- [ ] Dry-run App Review checklist bằng test app/live configuration.
- [ ] Không yêu cầu permission ngoài core use case.
- [ ] Live Meta end-to-end pass với tài khoản/Page hợp lệ trước closed beta.

**Dependencies:** Task 2.3

**Files likely touched:**
- `docs/meta-app-review.md` (mới)
- cấu hình backend OAuth broker/app dashboard ngoài repo khi cần

**Estimated scope:** Small/Medium

### Checkpoint Production OAuth + Onboarding

- [ ] Fresh user: mở app -> Kết nối Meta -> chọn Page -> sync lần đầu thành công.
- [ ] Expired/revoked/missing permission đều có recovery path rõ.
- [ ] Không nhập token thủ công; không expose token/App Secret cho renderer.
- [ ] Full quality gate pass và App Review evidence hoàn chỉnh.

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
- [x] Job state luôn kết thúc ở success/failed/cancelled hợp lệ trong các đường hoàn tất, lỗi và hủy đã test.
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
