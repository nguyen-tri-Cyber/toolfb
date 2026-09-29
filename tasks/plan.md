# Kế hoạch phát triển Facebook Sales Intelligence thành sản phẩm thương mại

## 1. Mục tiêu sản phẩm

Facebook Sales Intelligence (FSI) nên trở thành ứng dụng Windows local-first giúp người bán hàng, nhân viên chăm sóc khách hàng, quản trị Page, marketing/sales và agency biến dữ liệu tương tác trên Facebook Page thành danh sách cơ hội bán hàng có thể xử lý.

Luồng giá trị thương mại cốt lõi cần hoàn thiện trước mọi tính năng phụ:

> Cài ứng dụng → đăng nhập Meta → chọn Page → đồng bộ bài viết/bình luận → phát hiện bình luận có khả năng mua → đưa vào hộp Lead → xử lý trạng thái/ghi chú → lọc/tìm kiếm → xuất báo cáo.

AI là lớp tăng cường, không phải điều kiện để phần mềm hoạt động. Bản cơ bản phải tìm và quản lý lead bằng rule/keyword/heuristic cục bộ để khách hàng không phải tự cấu hình API AI và ứng dụng vẫn chạy tốt trên máy phổ thông.

## 2. Hiện trạng đã kiểm tra

### Owned Page MVP đã hoàn thành trong source hiện tại

- Electron + React + TypeScript, tách main/preload/renderer rõ ràng; `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- Typed preload API, IPC contracts và Zod validation tại boundary.
- SQLite + Drizzle, WAL mode, foreign keys và migration tương thích với database cũ cho các cột MVP mới.
- Meta development token được bảo vệ bằng Electron `safeStorage`; renderer không nhận raw token.
- Import Page sở hữu và đồng bộ post/comment thật vào SQLite.
- Graph API client có bounded pagination, timeout và retry/backoff hữu hạn.
- Post/comment/lead persistence chống tạo trùng khi đồng bộ lại.
- `sync_jobs` lưu SUCCESS/FAILED và recovery job RUNNING khi app khởi động lại.
- Đồng bộ tăng dần dùng mốc `last_synced_at` với overlap 7 ngày để giảm nguy cơ bỏ sót dữ liệu gần thời điểm đồng bộ.
- Rule engine tiếng Việt chạy local, có trọng số, negative patterns và lead scoring; core workflow không phụ thuộc AI.
- Posts và Comments UI dùng dữ liệu thật, có search/filter/pagination.
- Lead Inbox có filter, workflow trạng thái New/Contacted/Qualified/Won/Lost, note, tag và link nguồn.
- Xuất CSV UTF-8 theo filter hiện tại, có giới hạn số dòng và chống spreadsheet formula injection; không xuất token/raw JSON.
- Reports all-time có tổng lead, Won/conversion, status counts và top 5 bài viết.
- Renderer có CSP; external links đi qua handler kiểm soát và schema chỉ nhận HTTP/HTTPS.
- Kiểm tra ngày 2026-09-28: 14 test files / 29 tests pass, `npm run typecheck` pass, `npm run lint` pass, `npm run build` pass.

### Phần còn thiếu trước khi có thể bán như sản phẩm production

- Meta vẫn dùng development access token; production OAuth, App Review, permission lifecycle và reconnect flow chưa hoàn tất.
- Incremental sync chỉ quét lại post trong overlap 7 ngày; comment mới trên post cũ hơn cửa sổ này có thể chưa được lấy.
- Sync chưa có cancel/resume scheduler hoàn chỉnh.
- Chưa có backup/restore SQLite.
- Lead Inbox chưa có bulk actions và lịch sử thao tác.
- Export mới có CSV; chưa có XLSX.
- Reports mới là all-time; chưa có date-range analytics/funnel.
- Chưa có AI enrichment, quota/provider routing; đây là phần tăng cường, không phải dependency của core MVP.
- Chưa có installer thương mại, code signing, auto-update, license/activation, billing/subscription hoặc backend account layer.
- Chưa có telemetry/crash reporting opt-in, diagnostic bundle và closed beta với khách thật.
- Live Meta end-to-end vẫn cần xác minh trên môi trường người dùng với token/quyền hợp lệ; không sử dụng lại token từng xuất hiện trong lịch sử chat.

## 3. Định vị sản phẩm

Không nên biến FSI thành CRM/ERP tổng quát. Sản phẩm nên tập trung vào một lời hứa dễ hiểu:

> “Không bỏ sót khách có ý định mua trong bình luận Facebook Page.”

Nhóm người dùng phù hợp:

1. Shop nhỏ và vừa bán qua Facebook Page.
2. Nhân viên trực Page/chăm sóc khách hàng.
3. Sales/marketing cần gom lead từ comment.
4. Doanh nghiệp địa phương nhận tư vấn/đặt lịch qua Facebook.
5. Agency quản lý nhiều Page cho khách hàng.

Để phù hợp nhiều nhóm mà không làm UI phức tạp, dùng cùng một workflow lõi và khác nhau bằng preset:

- **Bán hàng:** ưu tiên hỏi giá, mua, đặt hàng, số điện thoại, inbox.
- **Dịch vụ:** ưu tiên nhu cầu tư vấn, đặt lịch, địa điểm, thời gian.
- **Agency:** nhiều Page, bộ lọc theo Page, báo cáo theo khách hàng.

## 4. Kiến trúc sản phẩm đề xuất

### Desktop local-first

Giữ Electron + SQLite cho dữ liệu vận hành cục bộ. Đây là lựa chọn hợp lý cho phiên bản đầu vì cài đặt đơn giản, không cần server riêng để xử lý dữ liệu hằng ngày và phù hợp máy Windows phổ thông.

### Backend thương mại tối thiểu

Thêm một backend nhỏ chỉ cho các chức năng cần tập trung:

- tài khoản người dùng;
- license/entitlement;
- quản lý thiết bị;
- OAuth callback/token exchange nếu kiến trúc Meta yêu cầu;
- billing/subscription;
- cấu hình feature flags;
- AI quota/provider routing cho gói có AI;
- update manifest/telemetry opt-in nếu cần.

Không chuyển toàn bộ Post/Comment/Lead lên cloud trong giai đoạn đầu. Dữ liệu nghiệp vụ mặc định vẫn ở máy người dùng.

### Data pipeline

```text
Meta OAuth
  → Page selection
  → Sync scheduler
  → Posts repository
  → Comments repository
  → Local lead detector
  → Lead repository
  → Optional AI enrichment
  → Lead Inbox / Analytics / Export
```

### Nguyên tắc AI

- Core product không phụ thuộc AI.
- AI chạy theo batch và cache kết quả vào `ai_analyses`.
- Provider abstraction để đổi model mà không chạm UI/workflow.
- Chỉ gửi trường dữ liệu tối thiểu cần phân tích.
- Có công tắc tắt AI hoàn toàn.
- Gói AI nên do sản phẩm quản lý quota thay vì bắt khách phổ thông nhập API key.

## 5. Roadmap phát triển

### Phase A — Productize nền móng

Mục tiêu: biến POC thành app mà người không kỹ thuật có thể cài, mở và kết nối.

#### Kế hoạch chi tiết — Production Meta OAuth + Onboarding

**Phạm vi của đợt này:** thay toàn bộ đường nhập development token bằng đăng nhập Meta production, giữ token ngoài renderer, cho người dùng chọn Page và chạy sync đầu tiên trong một onboarding ngắn. Chưa mở rộng sang scheduler, backup/restore, installer hay license trong đợt này.

**Kiến trúc mục tiêu:**

```text
Renderer
  -> IPC typed contract
  -> Electron main process
  -> mở trình duyệt hệ thống tới OAuth broker
  -> Meta Login / Facebook Login for Business
  -> backend callback + code/token exchange
  -> one-time desktop handoff
  -> main process lưu credential bằng safeStorage
  -> Graph API client dùng credential trong main process
  -> renderer chỉ nhận connection state + Page data
```

Không nhúng Meta App Secret vào Electron. Renderer không nhận access token. Backend broker chỉ xử lý phần cần secret/callback và trả về one-time handoff ngắn hạn cho desktop. Cơ chế callback cụ thể phải được xác minh lại với tài liệu Meta đang áp dụng cho app trước khi triển khai production; ưu tiên system browser và callback/deep-link hoặc loopback đã được Meta hỗ trợ chính thức.

**Quyền tối thiểu cho Owned Page MVP:**

- `pages_show_list`: lấy danh sách Page người dùng quản lý.
- `pages_read_engagement`: đọc nội dung/metadata do Page đăng.
- `pages_read_user_content`: đọc nội dung do người dùng tạo trên Page, đặc biệt comment mà FSI cần phân tích lead.
- Không xin `pages_manage_engagement`, `business_management` hoặc quyền write khác trong đợt này nếu core use case chưa cần.

Các quyền production phải đi qua App Review/Advanced Access phù hợp. Hồ sơ review cần quay đầy đủ flow login -> chọn Page -> hiển thị post/comment -> lead workflow bằng tài khoản test hợp lệ.

**Dependency graph:**

```text
OAuth contract + state model
  -> secure credential store
  -> OAuth broker/callback adapter
  -> IPC/preload contract
  -> Settings connection UI
  -> Onboarding shell
  -> Page selection/import
  -> first sync
  -> error/reconnect states
  -> App Review evidence + production checklist
```

**Thứ tự triển khai:**

1. Chốt typed state model: `disconnected | connecting | connected | expired | revoked | permission_missing | error`, cùng metadata an toàn như `checkedAt`, `accountName`, `grantedPermissions`, `missingPermissions`; không expose token.
2. Đổi `token.service.ts` thành credential store trung tính; giữ file development token cũ ngoài production flow và xóa file cũ sau khi production credential đã được lưu thành công.
3. Tạo OAuth broker contract trong main process: `connect()`, `completeCallback()`, `status()`, `reconnect()`, `disconnect()`. Thêm `state` chống CSRF/replay, timeout và one-time handoff; App Secret chỉ ở backend.
4. Mở rộng `MetaGraphApiClient` để validate `/me`, kiểm tra permission đã cấp và map lỗi Meta thành state rõ ràng thay vì chỉ `META_TOKEN_INVALID`/`META_PERMISSION_DENIED` chung chung.
5. Thay IPC `META_SAVE_DEVELOPMENT_TOKEN` bằng `META_CONNECT`, `META_RECONNECT`, `META_GET_CONNECTION_STATUS`, `META_DISCONNECT`; giữ `META_TEST_CONNECTION` chỉ nếu còn giá trị support.
6. Thay UI Settings: bỏ input token, thêm trạng thái tài khoản, quyền còn thiếu, nút Kết nối/Kết nối lại/Ngắt kết nối và mô tả tiếng Việt ngắn gọn.
7. Tạo onboarding 4 bước: Chào mừng -> Kết nối Meta -> Chọn Page -> Đồng bộ lần đầu. Cho phép bỏ qua và quay lại từ Settings.
8. Gắn Page selection với flow hiện có trong `Pages.tsx`; tái sử dụng `getAccessiblePages/importPage/syncPage`, không tạo pipeline sync thứ hai.
9. Bổ sung test cho state mapping, credential store, IPC contract, onboarding navigation và lỗi expired/revoked/missing permission.
10. Chuẩn bị App Review: privacy policy, data deletion instructions, screencast, test credentials/roles, permission use-case text, Data Use Checkup/compliance checklist nếu Meta yêu cầu cho app.

**Các file dự kiến chạm:**

- `src/main/meta/meta.service.ts`
- `src/main/meta/token.service.ts` (đổi vai trò thành credential store hoặc tách file mới)
- `src/main/meta/meta.client.ts`
- `src/main/meta/meta.errors.ts`
- `src/main/ipc/meta.ipc.ts`
- `src/main/index.ts`
- `src/shared/constants/ipc.ts`
- `src/shared/schemas/ipc.ts`
- `src/shared/types/ipc.ts`
- `src/preload/api.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/pages/Settings.tsx`
- `src/renderer/src/pages/Pages.tsx`
- `src/renderer/src/pages/Onboarding.tsx` (mới)
- test files tương ứng trong `src/main/meta`, `src/main/ipc`, `src/renderer`

**Checkpoint OAuth:** user có thể bấm Kết nối Meta, hoàn thành login ngoài renderer, quay lại app ở trạng thái `connected`, và token không xuất hiện trong renderer/log/SQLite.

**Checkpoint Onboarding:** user mới có thể đi từ mở app -> connect -> chọn Page -> import -> sync lần đầu mà không nhập token thủ công.

- Thay development-token UI bằng production Meta OAuth.
- Onboarding 4 bước: chào mừng → đăng nhập Meta → chọn Page → đồng bộ lần đầu.
- Trang Settings chuyển từ “cấu hình phát triển” thành kết nối tài khoản, dữ liệu, đồng bộ và quyền riêng tư.
- Bổ sung CSP, chuẩn hóa log, không ghi token/PII nhạy cảm.
- Thêm migration/versioning cơ sở dữ liệu thực tế thay vì phụ thuộc schema khởi tạo thủ công.
- Thêm backup/restore SQLite và nút reset dữ liệu có xác nhận.

**Checkpoint A:** người dùng mới cài app, kết nối Page và nhìn thấy Page đã chọn mà không phải biết Access Token là gì.

### Phase B — Đồng bộ dữ liệu thật

Mục tiêu: lấy được dữ liệu cần cho bài toán bán hàng một cách ổn định.

- Repository/service/IPC/UI cho Posts.
- Repository/service/IPC/UI cho Comments.
- Pagination và incremental cursor/time-window sync.
- `sync_jobs` trở thành state machine thực tế: pending/running/success/failed.
- Retry có backoff cho lỗi tạm thời; không retry vô hạn với lỗi permission.
- Có progress, cancel an toàn, resume và “sync lần cuối”.
- Dedupe bằng Facebook IDs.
- Chính sách retention để DB không tăng vô hạn.

**Checkpoint B:** Page có thể sync vài nghìn comment qua nhiều lần chạy mà không tạo bản ghi trùng và có thể tiếp tục sau lỗi mạng.

### Phase C — Lead Inbox không cần AI

Mục tiêu: tạo giá trị bán hàng đầu tiên có thể thu phí.

- Rule engine local: keyword, câu hỏi giá, số điện thoại, nhu cầu mua/đặt lịch/inbox, negative filters.
- Preset tiếng Việt theo nhóm ngành và cho phép người dùng sửa rule.
- Lead dedupe theo source comment/entity.
- Lead Inbox với search/filter/sort theo Page, bài viết, điểm, trạng thái, thời gian.
- Trạng thái: New, Contacted, Qualified, Won, Lost.
- Notes, tags, assignee local/profile đơn giản và lịch sử thay đổi.
- Mở permalink tới comment/post gốc.
- Bulk actions và export CSV/XLSX.

**Checkpoint C:** từ comment mới, hệ thống tự tạo lead, người dùng xử lý lead đến Won/Lost và xuất danh sách mà không cần AI.

### Phase D — AI enrichment

Mục tiêu: giảm thời gian đọc comment và tăng chất lượng ưu tiên lead.

- Provider interface + job queue.
- Phân loại buyer intent, intent type, sentiment, pain point, product interest, question, confidence.
- Chỉ AI-analyze dữ liệu đã qua rule prefilter để giảm chi phí.
- Batch processing, cache, retry và quota.
- UI hiển thị lý do/summary thay vì điểm số mơ hồ.
- Cho phép người dùng sửa kết quả và dùng feedback cho rule/prompt tuning sau này.

**Checkpoint D:** AI hỏng hoặc hết quota không làm mất workflow lead; người dùng vẫn dùng được toàn bộ core app.

### Phase E — Analytics và báo cáo

Mục tiêu: biến dữ liệu lead thành quyết định kinh doanh.

- Funnel New → Contacted → Qualified → Won/Lost.
- Lead theo Page/post/ngày/giờ.
- Post tạo nhiều lead nhất.
- Intent và câu hỏi thường gặp.
- Conversion theo Page và khoảng thời gian.
- Báo cáo xuất CSV/XLSX trước; PDF chỉ thêm khi có nhu cầu rõ.

**Checkpoint E:** chủ shop/agency có thể trả lời “Page/post nào tạo nhiều lead và lead nào đang bị bỏ quên?”.

### Phase F — Commercial shell

Mục tiêu: có thể phân phối, kích hoạt, cập nhật và hỗ trợ sản phẩm.

- Windows installer/uninstaller.
- Code signing.
- Auto-update có rollback/fallback.
- User account + license activation.
- Device limit và entitlement theo gói.
- Trial hợp lý, không khóa dữ liệu người dùng khi hết trial.
- Billing/subscription backend.
- Diagnostic bundle để support nhưng phải redaction token/PII.
- Privacy controls, data export, data deletion.

**Checkpoint F:** có thể gửi installer cho beta user, kích hoạt license, update lên version mới và thu log chẩn đoán mà không cần remote vào máy.

### Phase G — Beta và hardening

Mục tiêu: chứng minh app dùng được ngoài môi trường dev.

- E2E tests cho onboarding → sync → lead → export.
- Test database migration từ version cũ.
- Test rate limit, token expired, revoked permission, mạng chập chờn, DB locked/corrupt.
- Performance test với dữ liệu thực tế lớn.
- Accessibility và keyboard navigation.
- Crash recovery.
- Meta App Review/compliance checklist trước public launch.
- Pilot với nhóm nhỏ người dùng thật trước khi mở bán rộng.

## 6. MVP thương mại nên bán trước

Không chờ hoàn thiện toàn bộ roadmap. MVP thương mại đầu tiên chỉ cần:

1. Installer + onboarding.
2. Production Meta login.
3. Chọn 1–3 Page.
4. Sync Posts + Comments.
5. Rule-based Lead Detection.
6. Lead Inbox + status + note/tag.
7. Search/filter.
8. CSV/XLSX export.
9. Backup/restore.
10. License/trial tối thiểu.

Chưa cần cho MVP đầu:

- chatbot tự động trả lời;
- scraping ngoài Page được cấp quyền;
- CRM lớn kiểu HubSpot;
- multi-tenant cloud data warehouse;
- mô hình AI local nặng;
- social scheduling;
- quá nhiều biểu đồ;
- mobile app.

## 7. Gói sản phẩm đề xuất

### Starter

- 1 Page.
- Sync comment.
- Rule-based lead detection.
- Lead Inbox.
- Export cơ bản.

### Pro

- Nhiều Page.
- AI enrichment.
- Rule/preset nâng cao.
- Analytics đầy đủ.
- Backup tự động.

### Agency

- Nhiều workspace/Page.
- Báo cáo theo khách hàng.
- Quản lý seat/device.
- Export/report branding.

Giá cụ thể chỉ nên chốt sau pilot và đo giá trị thực tế: số lead tìm được, thời gian tiết kiệm và tỷ lệ người dùng quay lại.

## 8. Các quyết định kỹ thuật cần giữ

- Tiếp tục local-first cho nghiệp vụ chính.
- Giữ typed preload/IPC và validation boundary.
- Không cho renderer truy cập Node trực tiếp.
- Không lưu token trong SQLite/plaintext.
- Repository riêng cho Page/Post/Comment/Lead.
- Sync qua job abstraction thay vì gọi API trực tiếp từ component UI.
- Rule engine trước AI.
- Pagination/filter ngay từ đầu, không tải toàn bộ table lên renderer.
- Migration có version và test nâng cấp dữ liệu.
- Feature flags cho AI/licensing để core app vẫn đơn giản.

## 9. Rủi ro chính và cách giảm

| Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|
| Meta permission/App Review thay đổi | Cao | Dùng API chính thức, cô lập Meta adapter, kiểm tra permission/version trước release |
| Token hết hạn/revoke | Cao | OAuth refresh/reconnect UX, trạng thái kết nối rõ, retry có phân loại lỗi |
| Sync nhiều dữ liệu làm app chậm | Cao | Incremental sync, pagination, index, batch transaction, retention |
| AI tăng chi phí | Trung bình/Cao | Rule prefilter, batch, cache, quota, AI optional |
| DB local bị lỗi/mất máy | Cao | Backup/restore, migration test, recovery flow |
| Người dùng phổ thông khó cài/kết nối | Cao | Installer ký số, onboarding ngắn, không yêu cầu token/API key thủ công |
| Sản phẩm phình thành CRM tổng quát | Cao | Giữ core promise: comment → lead → xử lý → báo cáo |
| Support khó vì môi trường Windows đa dạng | Trung bình | Diagnostic bundle, structured logs, auto-update, minimum supported OS |

## 10. Chỉ số để biết sản phẩm đã có giá trị

Theo dõi các chỉ số sản phẩm sau trong pilot:

- % người cài hoàn thành kết nối Meta.
- Thời gian từ cài đặt đến thấy lead đầu tiên.
- Số comment sync thành công / thất bại.
- Số lead phát hiện / 1.000 comment.
- % lead được người dùng mở/xử lý.
- % lead chuyển Qualified/Won.
- Số phiên sử dụng/tuần.
- Tỷ lệ người dùng quay lại sau 7/30 ngày.
- Số export/report được tạo.
- AI cost / active customer đối với gói AI.
- Tỷ lệ crash và sync failure.

## 11. Thứ tự ưu tiên tuyệt đối

1. Production OAuth + onboarding.
2. Post/comment sync ổn định.
3. Lead Inbox rule-based.
4. Export + backup.
5. Installer + licensing/trial.
6. AI enrichment.
7. Analytics/reporting.
8. Agency/multi-user/cloud mở rộng.

Nếu chỉ có nguồn lực nhỏ, không phát triển song song tất cả màn hình. Hoàn thành từng vertical slice để mỗi phase đều tạo ra một sản phẩm chạy được và kiểm thử được.
