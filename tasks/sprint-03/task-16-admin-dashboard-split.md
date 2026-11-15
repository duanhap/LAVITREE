# TASK-16: Tách `AdminDashboard.tsx` thành các trang Admin riêng
* **Sprint**: Sprint 3
* **Phân hệ**: frontend/web (Admin)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Trưởng nhóm (làm cùng Claude Code)
* **Độ ưu tiên**: P2 - Nên làm trước khi thêm tính năng Admin mới
* **Tạo ngày**: 15/11/2026

---

## 1. BỐI CẢNH

`frontend/web/src/pages/AdminDashboard.tsx` có **10.082 dòng** (đo ngày 15/11/2026, commit `d8bf0fd`). Một component phục vụ 5 trang Admin; router truyền `defaultTab` khác nhau và thanh tab bị ẩn:

| Đường dẫn | Trang | Vị trí trong file (dòng, xấp xỉ) |
|---|---|---|
| `/admin/ingest` | Nhập bài báo (kèm tab con "đã duyệt", "dán lại" và chế độ `?edit=`) | 5016–6470 |
| `/admin/knowledge` | Duyệt tri thức | 6471–7141 |
| `/admin/images` | Ảnh triệu chứng | 7142–7388 |
| `/admin/inventory` | Vật tư, thuốc BVTV, gợi ý vật tư | 7389–8112 |
| `/admin/escalations` | Câu hỏi chuyển chuyên gia | 8113–8225 |

Phần còn lại của file:
- Dòng 1–717: interface, hàm tiện ích không dùng React (đọc ngày, tác giả, cơ quan, `isSafeHttpUrl`, `findDuplicateChunks`…).
- Dòng 718–4980: **146 `useState`** và các handler của cả 5 trang, chung một component.
- Dòng 8226–10.082: 11 hộp thoại (Dialog) của mọi tab, gom ở cuối file.

`/admin` (Tổng quan, `AdminOverviewPage.tsx`) và `/admin/knowledge-collector` đã là file riêng.

### Vấn đề

| # | Vấn đề | Hệ quả |
|---|---|---|
| V1 | Mở trang nào cũng tải code của cả 5 trang | Bundle trang Admin lớn; gõ một ký tự vào ô bài báo làm render lại cả component 10k dòng |
| V2 | Nhiều người hoặc agent cùng sửa một file | Xung đột thường xuyên; phải tách commit thủ công (TASK-15 R25–R36 phải lọc từng hunk) |
| V3 | State và handler của các trang nằm lẫn nhau | Khó review; sửa một trang dễ ảnh hưởng trang khác. TASK-15-R32 từng phải sửa lỗi build do file bị cắt cụt khi chỉnh sửa |
| V4 | Hàm tiện ích nằm trong file trang | Không viết unit test được, chỉ kiểm tra bằng script tạm |

---

## 2. MỤC TIÊU VÀ NGUYÊN TẮC

- Mỗi trang Admin là một file trang riêng, router trỏ thẳng vào. Không còn prop `defaultTab`.
- **Không đổi giao diện, chức năng hay API.** Đây là refactor thuần. Lỗi phát hiện trong lúc tách thì ghi lại và sửa ở commit riêng.
- Mỗi bước là một commit độc lập, build được và chạy được.
- Không trộn với tính năng mới. Tính năng Admin mới làm sau khi trang liên quan đã được tách.

---

## 3. CẤU TRÚC ĐÍCH (DỰ KIẾN)

```text
frontend/web/src/
├── pages/admin/
│   ├── AdminIngestPage.tsx          # /admin/ingest (+ ?edit=)
│   ├── AdminKnowledgePage.tsx       # /admin/knowledge
│   ├── AdminImagesPage.tsx          # /admin/images
│   ├── AdminInventoryPage.tsx       # /admin/inventory
│   └── AdminEscalationsPage.tsx     # /admin/escalations
└── features/admin/
    ├── types.ts                     # KnowledgeSourceItem, MedicineItem, ProductSuggestionItem, EscalationItem…
    ├── lib/
    │   ├── article-metadata.ts      # extractKeyMetadataFromText, extractDateFromSegment, normalizeDateDisplay…
    │   ├── source-format.ts         # build/parseCombinedOrg, build/parseCombinedDate, inferSourceScope
    │   ├── duplicates.ts            # findDuplicateChunks
    │   └── url.ts                   # isSafeHttpUrl
    ├── hooks/                       # useDiseaseOptions, useKnowledgeSources… (dữ liệu nhiều trang cùng dùng)
    └── components/
        ├── ArticleEditor.tsx        # khung dán bài + Xem định dạng / Code Markdown + nút Mẹo
        └── ...                      # Dialog của từng trang đi theo trang đó
```

Tên file và cách chia hook có thể đổi khi bắt tay làm; ghi lại thay đổi vào mục 5.

---

## 4. KẾ HOẠCH TỪNG BƯỚC

| Bước | Nội dung | Kiểm tra |
|---|---|---|
| B0 | Chuyển interface sang `features/admin/types.ts`, hàm tiện ích không dùng React sang `features/admin/lib/` | `tsc`; chạy lại script kiểm tra `extractKeyMetadataFromText` (Haravan `My Trần` / `11/08/2025`…) cho kết quả như cũ |
| B1 | Tách **Ảnh triệu chứng** → `AdminImagesPage` (state, handler, 3 Dialog ảnh) | Xem danh sách, thêm, xóa, phóng to ảnh |
| B2 | Tách **Chuyển chuyên gia** → `AdminEscalationsPage` | Xem ca, trả lời hoặc đóng ca |
| B3 | Tách **Vật tư** → `AdminInventoryPage` (sửa/tạo thuốc, gắn gợi ý, xem bằng chứng) | Tạo và sửa sản phẩm, gắn hoặc bỏ qua gợi ý |
| B4 | Tách **Duyệt tri thức** → `AdminKnowledgePage` | Duyệt, bỏ duyệt, xóa bài; nút "Sửa bài" vẫn mở `/admin/ingest?edit=` |
| B5 | Tách **Nhập bài báo** → `AdminIngestPage`; khung soạn bài thành `ArticleEditor` | Dán bài, tách đoạn, AI tự điền, lưu; chế độ `?edit=`; tab "đã duyệt" và "dán lại" |
| B6 | Xóa `AdminDashboard.tsx`, cập nhật `router.tsx` và tài liệu | `npm run build`; mở lần lượt cả 7 đường dẫn `/admin/*` |

Mỗi bước: `tsc --noEmit` và `npm run build` phải qua; kiểm tra trên trình duyệt (Playwright hoặc bấm tay) các luồng ghi ở cột "Kiểm tra"; ghi một dòng WORKLOG `TASK-16-Rn`.

Thứ tự đi từ trang ít phụ thuộc đến trang rối nhất. Trang Nhập bài báo để cuối vì dùng chung nhiều state nhất (chế độ sửa bài, giới hạn trích, gợi ý vật tư).

---

## 5. RỦI RO VÀ LƯU Ý

- **State dùng chung giữa các tab** (danh sách bệnh, danh sách nguồn, `sources` cập nhật sau khi xóa…): mỗi trang tự tải. Nếu trùng nhiều thì gom vào hook trong `features/admin/hooks/`. Không thêm thư viện quản lý state.
- **Liên kết giữa trang**: Duyệt tri thức → Nhập bài báo đang đi qua URL `?edit=`, giữ nguyên cách này.
- **Đang có người sửa song song** (agent khác làm TASK-15): trước mỗi bước phải kéo bản mới nhất và commit hết phần đang dở, tránh phải tách lại file 10k dòng.
- Chưa có công cụ unit test ở `frontend/web` (không có vitest/jest). Có thể thêm `vitest` cho `features/admin/lib/` ở B0. Đây là quyết định riêng, cần trưởng nhóm đồng ý vì thêm dependency.

---

## 6. TIÊU CHÍ HOÀN THÀNH

- [ ] Không còn `AdminDashboard.tsx`; mỗi đường dẫn `/admin/*` có file trang riêng, không file nào quá khoảng 2.000 dòng.
- [ ] Giao diện và luồng của cả 5 trang giống trước khi tách (đối chiếu bằng ảnh chụp trước/sau).
- [ ] `npm run build` thành công; không lỗi console khi mở từng trang.
- [ ] Hàm tiện ích nằm trong `features/admin/lib/`, không phụ thuộc React.
