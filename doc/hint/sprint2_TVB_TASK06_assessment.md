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