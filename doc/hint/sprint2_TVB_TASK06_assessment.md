## Kết luận: TASK-06 **chạy được trên máy của B, nhưng chưa đạt để nghiệm thu.**
Mình đã chạy [test_rag_accuracy.py](backend/agent-service/test_rag_accuracy.py): **4/4 PASS**, Recall@3 = 10/10. Khung thiết kế đúng hướng: hybrid BM25 + vector + RRF, id ChromaDB lấy theo id Postgres, có `citations`, có guardrail cho label-paragraphs. Tuy vậy còn **4 lỗi 🔴**, trong đó 2 lỗi mình đã chạy thử và tái hiện được.

---

## 🔴 Phải sửa

**1. Bài chưa duyệt vẫn lọt vào RAG, phá luật HITL.** Câu truy vấn trong [sync_index.py:29-34](backend/agent-service/app/rag/sync_index.py#L29-L34) chỉ lọc `IsDeleted = false` và **không lọc `IsManualApproved`**. Comment ở dòng 45 ghi "chỉ nạp bài đã duyệt", nhưng code lại nạp tất cả. Hệ quả:
- Bài chưa duyệt vẫn được AI trích dẫn cho nông dân.
- Admin bấm **Bỏ duyệt** cũng không có tác dụng gì.
- Thêm nữa, `unit_type` và `is_verbatim` đang bị gán cứng là `SUMMARY`/`False` ([dòng 56-57](backend/agent-service/app/rag/sync_index.py#L56-L57)). Đoạn nguyên văn do A03 nhập sẽ bị ghi nhầm thành "tóm tắt" trong `citations`.

→ Sửa: thêm `AND "IsManualApproved" = true` và SELECT thêm `"UnitType", "IsVerbatim"` (sau khi A chạy migration).

**2. DB lỗi thì lặng lẽ dùng CSV cũ (fail-open).** [sync_index.py:130-134](backend/agent-service/app/rag/sync_index.py#L130-L134): khi kết nối Postgres lỗi (sai mật khẩu, DB khởi động chậm), code tự quay về đọc file CSV seed. Mà loader CSV lại **tự coi 19 bài demo là đã duyệt** ([dòng 94, 109](backend/agent-service/app/rag/sync_index.py#L94)). Ví dụ cụ thể: admin bỏ duyệt một bài sai → Core gọi reindex → DB chập chờn → bài sai **quay lại**, và API vẫn trả `"status": "success"`.

→ Sửa: chỉ dùng CSV khi bật biến `RAG_ALLOW_CSV_FALLBACK=1` (máy dev). Production lỗi DB thì trả `503` và **giữ nguyên chỉ mục cũ**.

**3. Chạy trong Docker thì vector search hỏng mà không báo lỗi.** Mình đã giả lập môi trường Docker (không có cache model):
```
Could not load BAAI/bge-m3 ... Fallback failed ... all-MiniLM-L6-v2
model loaded: False
vector dim: 384  all zeros: True
```
Nguyên nhân: [vector_retriever.py:22-23](backend/agent-service/app/rag/vector_retriever.py#L22-L23) ép chế độ offline, mà Dockerfile không tải model, nên **mọi vector đều bằng 0**. Từ đó tìm kiếm ngữ nghĩa trả kết quả rác, kèm 2 vấn đề khác:
- Chỉ mục dựng bằng bge-m3 có 1024 chiều, query lại có 384 chiều nên ChromaDB báo lỗi. Lỗi này bị `try/except` ở [main.py:237](backend/agent-service/app/main.py#L237) nuốt mất, nên `citations` luôn rỗng.
- Model đang dùng là **bge-m3 (~2.2GB)**, không phải model ticket đã chốt (`paraphrase-multilingual-MiniLM-L12-v2`). Model fallback `all-MiniLM-L6-v2` lại là **model chỉ dùng tiếng Anh**.

→ Sửa:
- Thống nhất một model và tải sẵn khi `docker build`.
- Không load được model thì **dừng service**, tuyệt đối không trả vector 0.
- Lưu tên model vào metadata của collection, khi load thì kiểm tra khớp.

**4. Reindex làm đứng toàn bộ chat, và nếu lỗi giữa chừng thì chỉ mục trống.**
- `async def trigger_reindex` ([main.py:72](backend/agent-service/app/main.py#L72)) gọi hàm đồng bộ mất khoảng **23 giây** (đo thật lúc chạy test). Trong thời gian đó event loop bị chặn, **mọi luồng SSE của nông dân đều đứng**. `label_paragraphs` ([main.py:89](backend/agent-service/app/main.py#L89)) gọi Gemini cũng mắc lỗi tương tự.
- [vector_retriever.py:85](backend/agent-service/app/rag/vector_retriever.py#L85) **xoá collection trước rồi mới nạp lại**:
  - Trong khoảng 23 giây đó RAG trống.
  - Embedding lỗi giữa chừng thì mất luôn chỉ mục.
  - Hai lần reindex chạy cùng lúc (duyệt hàng loạt + duyệt lẻ) sẽ đè nhau.

→ Sửa:
- Đổi hai endpoint thành `def` để FastAPI chạy chúng trong threadpool.
- Thêm `threading.Lock`.
- Dựng chỉ mục vào collection mới, xong mới đổi sang dùng, rồi xoá collection cũ.

## 🟠 Nên sửa
| # | Vấn đề | Đề xuất |
|---|---|---|
| 5 | Khoá nội bộ có **giá trị mặc định viết cứng trong code** ([main.py:42](backend/agent-service/app/main.py#L42)). Thiếu biến env thì ai đọc repo cũng biết khoá | Thiếu `INTERNAL_API_SECRET` thì từ chối mọi request (fail-closed), giống cách đã sửa admin key ở Sprint 1 |
| 6 | `CORS allow_origins=["*"]` kèm `allow_credentials=True` ([main.py:26-32](backend/agent-service/app/main.py#L26-L32)) | Trình duyệt đã đi qua nginx cùng origin, nên **xoá hẳn CORS** ở agent |
| 7 | `/consult-treatment` vẫn dùng mock có **PHI viết cứng** ([knowledge_retriever.py](backend/agent-service/app/rag/knowledge_retriever.py)), trái quy tắc "PHI chỉ lấy từ `Products`" | Xoá endpoint và file mock |
| 8 | `label-paragraphs` tự parse JSON ([main.py:96-97](backend/agent-service/app/main.py#L96-L97)): body sai thì trả 500, và **không giới hạn số đoạn hay độ dài** (tốn quota Gemini) | Dùng body có kiểu Pydantic với `max_length` (≤ 200 đoạn, ≤ 2000 ký tự/đoạn) |
| 9 | Đang dùng model `gemini-1.5-flash` và SDK `google.generativeai`. Khi chạy test, chính SDK đã in cảnh báo "support has ended" | Chuyển sang `google-genai` với Gemini 2.x như ticket ghi. Model 1.5 bị tắt thì AI gợi ý sẽ âm thầm ngừng chạy |
| 10 | Không có `.dockerignore`, nên `COPY . .` đưa cả `app/data` (chỉ mục dev dựng từ CSV, gồm bài chưa duyệt) và `__pycache__` vào image | Thêm `.dockerignore` loại `app/data`, `__pycache__` |
| 11 | Chưa có script tạo **role DB chỉ đọc** `lavitree_agent` (mình tìm trong repo không thấy) | Thêm file SQL vào `backend/core-api/seed/` hoặc script init của Postgres |
| 12 | Import `app.rag` là khởi tạo pipeline ngay, tức load model và có thể reindex luôn ([pipeline.py:193](backend/agent-service/app/rag/pipeline.py#L193), [__init__.py](backend/agent-service/app/rag/__init__.py)). Khi giả lập, mình thấy model bị load 2 lần | Khởi tạo trong sự kiện `startup` của FastAPI |

## 🟡 Về "tối ưu" và độ tin của số đo
- **Độ trễ 237ms vượt mục tiêu ≤ 200ms của ticket.** Test đã tự nới ngưỡng thành 260ms ([dòng 136](backend/agent-service/test_rag_accuracy.py#L136)). Nguyên nhân chính là bge-m3 quá nặng cho CPU. Dùng model MiniLM như spec sẽ nhanh hơn nhiều.
- **Recall 100% đo trên 22 tài liệu**, trong đó 19 là bài demo (CSV fallback), nên dễ đạt. Hơn nữa, câu hỏi chứa sẵn tên khoa học có trong dữ liệu (*Corynespora cassiicola*, *Puccinia sorghi*), mà nông dân thì không gõ như vậy. Nên bổ sung câu hỏi kiểu nông dân và đo trên toàn bộ bài đã duyệt.
- Câu hỏi không dấu (`la ca chua bi moc trang mat duoi la`): mình thử thì **vẫn tìm đúng**, nên điểm này ổn.
- BM25 tách từ lại toàn bộ tài liệu ở **mỗi lần query** ([bm25_retriever.py:74-80](backend/agent-service/app/rag/bm25_retriever.py#L74-L80)). Nên tính sẵn số lần xuất hiện của từ lúc `fit`.
- RRF đang dùng trọng số theo từ khoá "thuốc" ([hybrid_fusion.py:24-31](backend/agent-service/app/rag/hybrid_fusion.py#L24-L31)), lệch so với RRF chuẩn trong spec. Được phép giữ, nhưng nên đo cả hai cách và ghi vào báo cáo.

---

**Thứ tự B nên sửa:** 1 → 2 → 4 → 3 (bốn lỗi 🔴), sau đó 5–8. Các lỗi 🔴 đều nhỏ, mỗi lỗi chỉ vài dòng code, trừ lỗi 3 phải sửa thêm Dockerfile.

Mình chưa sửa file code nào. Lần chạy test vừa rồi chỉ dựng lại chỉ mục local trong `app/data` từ CSV, giống hệt cách B vẫn chạy. Bạn muốn mình viết bản sửa cho B, hay để B tự sửa theo danh sách trên?


## Kết luận: TVB đã sửa đúng khá nhiều, nhưng **TASK-06 vẫn chưa nghiệm thu được**
Bộ test của B báo **5/5 PASS**, nhưng nó không bắt được các lỗi dưới đây. Mình kiểm chứng trên bản sao trong scratchpad, không sửa file nào của B. Mình không gọi Gemini thật, các ca lỗi Gemini đều dùng mock.

## ✅ Đã sửa đạt
| Lỗi cũ | Hiện tại |
|---|---|
| Bài chưa duyệt lọt vào RAG | Đã lọc `IsManualApproved = true`, đọc thêm `UnitType`/`IsVerbatim` ([sync_index.py:41-47](backend/agent-service/app/rag/sync_index.py#L41-L47)) |
| DB lỗi thì lặng lẽ dùng CSV | Trả 503 và giữ index cũ, CSV chỉ dùng khi bật cờ dev |
| Vector toàn số 0 | Đã bỏ, không load được model thì báo lỗi; Dockerfile tải sẵn model |
| Khoá nội bộ viết cứng, CORS `*`, `/consult-treatment` mock | Đã bỏ hết |
| Reindex xoá trước, nạp sau | Đã có Blue-Green cho vector |
| `.dockerignore`, giới hạn input, BM25 tách từ lại mỗi query | Đã có |

Độ trễ cũng đã đạt: **151–157ms**, dưới mục tiêu 200ms.

## 🔴 Phải sửa trước khi nghiệm thu
**1. Tính năng AI gợi ý nhãn không chạy được với Gemini thật.**
- Code gọi `gemini-2.0-flash`, dự phòng là `gemini-1.5-flash` ([pipeline.py:176,192](backend/agent-service/app/rag/pipeline.py#L176)). Theo tài liệu Google, cả hai **đã bị tắt** (1.5 từ 29/09/2025, 2.0 từ 01/06/2026).
- `google-genai` còn **không có trong** [requirements.txt](backend/agent-service/requirements.txt), nên trong Docker sẽ lỗi import ngay.
- Test vẫn PASS vì dùng mock.
- Khi Gemini lỗi, API trả `200 {"labels":[]}`, nên Core không biết để báo `ai_suggestion_available: false` như hợp đồng dòng 471.

→ Sửa: thêm `google-genai`, đọc tên model từ env `GEMINI_MODEL`, bỏ nhánh 1.5, và khi lỗi thì trả 503. Ticket và `.env.example` đang ghi Gemini 2.x, nên TASK-08 cũng cần xem lại model.

**2. Bỏ duyệt bài cuối cùng thì bài vẫn còn trong RAG.** Không còn bài nào được duyệt thì `reindex` thoát sớm ([pipeline.py:58-60](backend/agent-service/app/rag/pipeline.py#L58-L60)). Mình chạy thử: `sync returned 0 ; chroma still 1 ; bm25 still 1`, mà API vẫn trả `success`.

→ Sửa: danh sách rỗng từ DB (truy vấn thành công) thì dựng index rỗng.

**3. Container mới không có dữ liệu RAG.** `app/data` đã bị loại khỏi image, compose không có volume, lúc khởi động cũng không sync. Chạy thử: chat đầu tiên mất **21,6 giây** và **0 citation**, không báo lỗi gì. Mỗi lần deploy, RAG sẽ trống cho tới khi có người duyệt bài. Model load lỗi cũng chỉ lộ ra ở request đầu tiên, nên service vẫn báo healthy.

→ Sửa: load model và sync trong sự kiện `startup` của FastAPI, thêm volume cho `app/data`.

**4. Reindex vẫn làm đứng toàn bộ chat.** Phần này mới sửa một nửa: có lock nhưng vẫn là `async def` ([main.py:71](backend/agent-service/app/main.py#L71), [main.py:111](backend/agent-service/app/main.py#L111)). Đo được reindex **18,4 giây thì event loop đứng đúng 18,4 giây**. Hợp đồng lại cho Core timeout 5 giây, nên Admin sẽ thường xuyên thấy `reindex_status: failed`, dù reindex vẫn chạy xong.

→ Sửa theo 3 bước:
- Đổi hai endpoint sang `def`.
- Reindex nên nhận yêu cầu rồi chạy nền, trả 202 (cần sửa hợp đồng).
- Sau khi đổi, sửa cả lock: hiện yêu cầu đến giữa lúc đang chạy sẽ bị 409 và **mất luôn**, bài vừa bỏ duyệt có thể còn trong index. Nên đặt cờ "cần chạy lại" để chạy thêm một lượt.

**5. Script role chỉ đọc không chạy được.** Script [03_create_agent_readonly_role.sql](backend/core-api/seed/03_create_agent_readonly_role.sql) có 3 lỗi:
- `GRANT` trên bảng `"Plants"`, mà bảng này **không tồn tại** (tên thật là `PlantCategories`).
- Có **mật khẩu 26 ký tự viết cứng** trong file. Nếu đã commit thì coi như lộ, cần đổi và tách ra biến.
- Thiếu `Products`, mà TASK-07 cần để đọc PHI.

Ngoài ra, script chỉ cấp quyền trên database `lavitree`. Nếu Core dùng Supabase (database `postgres`) mà `AGENT_DB_URL` vẫn trỏ Postgres local như `.env.example`, Agent sẽ đọc **nhầm DB**.

**6. Số Recall 100% không còn phản ánh đúng.** [test_rag_accuracy.py:150](backend/agent-service/test_rag_accuracy.py#L150) lọc theo `disease_code` rồi lại kiểm tra đúng mã bệnh đó, nên gần như chắc chắn trúng. Ticket ([dòng 147](tasks/sprint-02/task-06-hybrid-rag-knowledge.md#L147)) yêu cầu đo **không lọc**. Mình đo lại cùng bộ câu hỏi: **9/10 = 90%**, vừa chạm ngưỡng, và trên 22 bài trong CSV chứ chưa phải dữ liệu thật.
- Câu trượt: "phòng trị bệnh đốm mục tiêu trên cây cà chua".
- Ngưỡng độ trễ trong test cũng đang là 220ms, trong khi ticket ghi 200ms.

## 🟠 Nên sửa
| # | Vấn đề | Bằng chứng | Sửa |
|---|---|---|---|
| 7 | Bệnh chưa có bài duyệt lại **trích dẫn bệnh khác** cho nông dân | Bệnh ngô Northern Leaf Blight trích `Tomato___healthy`, `Tomato___Early_blight` ([pipeline.py:118-123](backend/agent-service/app/rag/pipeline.py#L118-L123)) | Khi có `disease_code` thì bỏ tìm toàn cục, trả rỗng |
| 8 | Gemini trả sai định dạng thì API trả 500, kết quả trùng id vẫn lọt qua | Trả dict hoặc list chuỗi → 500; P1 xuất hiện 2 lần ([pipeline.py:204-210](backend/agent-service/app/rag/pipeline.py#L204-L210)) | Kiểm tra kiểu dữ liệu, loại trùng, đặt timeout |
| 9 | Kiểm tra khoá chạy **sau** khi validate body | Không có khoá mà body sai → 422 thay vì 401 | Dùng `Depends(check_internal_auth)` |
| 10 | Khoá có ký tự lạ làm API trả 500 | Header `é` → 500 ([main.py:52](backend/agent-service/app/main.py#L52)) | So sánh trên bytes |
| 11 | Lỗi DB gửi nguyên văn cho bên gọi, lộ host và port | Thông báo chứa `connection to server at "127.0.0.1", port 1` ([main.py:99,105](backend/agent-service/app/main.py#L99)) | Chi tiết chỉ ghi log, trả câu chung |
| 12 | Có lưu tên model nhưng không kiểm tra khi load | Đổi model thì lỗi lệch 1024/384, bị nuốt thành citation rỗng | So sánh metadata khi khởi động |
| 13 | BM25 lỗi sau khi vector đã đổi thì hai index lệch nhau | Chroma 1 bài, BM25 22 bài | Dựng BM25 trước, rồi mới đổi cả hai |
| 14 | Dùng `bge-m3` trong khi ticket ghi MiniLM | [Dockerfile:15-17](backend/agent-service/Dockerfile#L15-L17) | Chốt một model, xem mục dưới |
| 15 | Thư viện chưa ghim phiên bản; container chạy root; `/chat` không giới hạn độ dài `message` | [requirements.txt](backend/agent-service/requirements.txt), [main.py:60](backend/agent-service/app/main.py#L60) | Ghim version, thêm `USER`, thêm `max_length` |

**Về model (#14), mình đề xuất giữ `bge-m3`** nếu độ trễ vẫn đạt, vì đổi model sẽ phải đo lại Recall. Khi đó cần cập nhật ticket và ghi lý do chọn vào báo cáo, đổi lại image nặng hơn. Nếu server demo ít RAM thì quay về MiniLM như ticket.

## Thứ tự sửa cho B
1. **Sửa trước:** #1, #2, #5 (nhanh, đều chỉ vài dòng).
2. **Sửa tiếp:** #3, #4 (thay đổi cách chạy, cần thống nhất với A về 202).
3. **Sửa test:** #6, thêm test cho #2 và #7, rồi báo cáo số thật.
4. **Cuối cùng:** các mục 🟠 còn lại.

**Phía A:** Core chưa có code nào gọi `/internal/reindex` hay `label-paragraphs`, và cũng chưa có `UnitType`/`IsVerbatim`. Vì vậy luồng duyệt bài → reindex → citation **chưa được kiểm thử end-to-end**. Riêng code B đọc 2 cột mới mình cũng chưa chạy được trên Postgres thật. Sau khi A xong migration, nên bỏ đoạn kiểm tra cột động ([sync_index.py:30-39](backend/agent-service/app/rag/sync_index.py#L30-L39)), vì nó che mất lỗi khi thiếu migration.

Bạn có thể gửi nguyên danh sách này cho B. Nếu muốn, mình viết sẵn bản sửa cho #1, #2, #5.

Sources:
- [Gemini API release notes](https://ai.google.dev/gemini-api/docs/changelog)
- [Gemini 2.0 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.0-flash)
- [Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
///
## Xong: code TASK-06 phía agent-service đã sửa hết các lỗi trong review (🔴 và 🟠), tài liệu đã cập nhật
Mình **chưa commit**, các thay đổi đang nằm trong working tree của nhánh `feat/task-06-hybrid-rag-knowledge`. TASK-06 vẫn **chưa đóng hẳn**: còn 3 thứ mình không chạy được (xem mục dưới), nên mình đổi TODO từ `DONE` về `IN PROGRESS`.

## Kết quả kiểm chứng
| Kiểm tra | Kết quả |
|---|---|
| [test_rag_accuracy.py](backend/agent-service/test_rag_accuracy.py) viết lại | **11/11 PASS** (dùng CSV seed, Gemini mock) |
| Recall@3 không lọc (đúng yêu cầu ticket) | **9/10 = 90%**, vừa chạm ngưỡng, đo trên 22 bài |
| Độ trễ | **145ms** (mục tiêu ≤ 200ms) |
| Reindex trên server thật | Trả `202` trong **0,38 giây**; 7 lượt chat trong lúc reindex đều có citation, chậm nhất 0,66 giây |
| 8 yêu cầu reindex cùng lúc | Không lỗi, chat vẫn có citation |
| Model embedding hỏng | Service dừng (exit code 3), không chạy với tìm kiếm hỏng |
| Role DB trên PostgreSQL 16 thật | Đọc được 2 bảng cần thiết; `INSERT`/`UPDATE`/`DELETE`/`CREATE TABLE` và đọc `Users` đều bị chặn |
| Loader trên PostgreSQL thật | Chỉ lấy bài đã duyệt, chạy được cả trước và sau migration A03 |

## Đã sửa
- **Gemini:** chuyển sang `google-genai`, tên model đọc từ env `GEMINI_MODEL` (mặc định `gemini-3.5-flash-lite`). Khi lỗi thì trả 503 để Core báo Admin tự gán nhãn.
- **HITL:** bỏ duyệt bài cuối cùng là gỡ được khỏi RAG. Bệnh chưa có bài duyệt thì không trích dẫn bài của bệnh khác.
- **Khởi động:** service tự dựng index, thêm volume `agent_data`.
- **Reindex:** chạy nền ([reindex_worker.py](backend/agent-service/app/rag/reindex_worker.py)), không mất yêu cầu nào, DB lỗi thì tự thử lại, có thêm `GET /internal/reindex/status`.
- **Bảo mật:**
  - Kiểm tra khoá trước khi đọc body, khoá có ký tự lạ không còn gây 500.
  - Lỗi không còn lộ host DB.
  - Bỏ pickle, container chạy user thường, giới hạn độ dài input chat.
- **Role SQL:** bỏ mật khẩu viết cứng, bỏ bảng `Plants` không tồn tại, thêm `Products`.
- **Docker:** ghim phiên bản thư viện, dùng torch bản CPU cho nhẹ image.

**Tài liệu đã cập nhật:** `api-contracts.md`, `sprint-02.md`, `task-06`, `task-07`, `task-a03`, `TODO.md`, `WORKLOG.md`, `.env.example`.

## Bạn cần làm
1. **Đổi mật khẩu role DB.** Mật khẩu cũ đã nằm trong commit `8602b8e`, nên coi như lộ. Khi tạo role, hãy dùng mật khẩu mới (giữ trong `.env`, cùng giá trị với `AGENT_DB_URL`). Chạy sau khi đã có migration:
   ```bash
   psql -v agent_db_password="$AGENT_DB_PASSWORD" -f backend/core-api/seed/03_create_agent_readonly_role.sql "<ADMIN_DB_URL>"
   ```
2. **Báo A hai thay đổi trong hợp đồng API:**
   - `/internal/reindex` giờ trả `202`, và `reindex_status` là `accepted` hoặc `failed`.
   - `label-paragraphs` trả `503` khi Gemini lỗi, nên Core phải đặt timeout gọi endpoint này ≥ 35 giây.
3. **Cập nhật secret `ENV_PRODUCTION`** trên GitHub: thêm `AGENT_DB_URL` và `INTERNAL_API_SECRET`. `AGENT_DB_URL` phải trỏ **cùng DB với Core**, nếu dùng Supabase thì theo mẫu trong `.env.example`.

## Chưa chạy được
- **`docker build`:** Docker Desktop đang tắt và bản build tải nhiều GB nên mình không tự bật. Mình mới kiểm tra được bộ thư viện cài được trên Linux/Python 3.11. Khi bật Docker, chạy:
  ```bash
  docker compose build agent-service && docker compose up -d agent-service
  ```
  Lệnh `up` cần file `.env` có `POSTGRES_PASSWORD`, `AGENT_DB_URL` và `INTERNAL_API_SECRET`.
- **Gemini thật:** tên model lấy từ tài liệu Google, chưa gọi thật vì mình không dùng khoá API của bạn. Cần thử với 3 bài báo thật theo tiêu chí ticket.
- **Luồng Core → Agent:** Core chưa có code gọi các endpoint này, nên phải chờ A03 mới test được duyệt bài → reindex → citation.

## Hai điểm nên biết
- **Recall 90% không có dư địa.** Câu "phòng trị bệnh đốm mục tiêu trên cây cà chua" vẫn trượt, và bệnh này mới có 1 bài duyệt. Mình cố ý không chỉnh để ép số, vì ticket yêu cầu báo số thật. Nên thêm bài cho Target Spot qua A03 rồi đo lại trên DB demo.
- **Mình giữ `bge-m3`**, không quay về MiniLM như ticket cũ, và đã ghi lý do vào ticket. Đổi lại image sẽ nặng hơn, mình chưa đo được dung lượng.

Khi cần commit, bạn chỉ cần báo mình.
///
giải thích các cau trả loiwd của agenht nay cho tôi vs