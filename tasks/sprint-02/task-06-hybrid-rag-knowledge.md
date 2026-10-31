# TASK-06: TẦNG TRI THỨC HYBRID RAG ĐA NGÔN NGỮ (BM25 + CHROMADB) & PIPELINE NẠP DỮ LIỆU KIỂM ĐỊNH (HITL)
* **Sprint**: Sprint 2 (Trí tuệ Nhân tạo Tác tử & Hệ sinh thái MCP)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 1 (Làm đầu tiên để có dữ liệu cho các Task 05, 07, 08)**
* **Phân hệ**: `backend/agent-service/app/rag/` & CSDL `backend/core-api`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (RAG Pipeline & ChromaDB) & Thành viên A (PostgreSQL Schema & Seed)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Kế thừa từ nguyên mẫu**: `extract/DAY18/lavitree_production_rag_pipeline.py` & `extract/KnowledgeSources_rows.csv`

---

## 1. BỐI CẢNH & NGUYÊN TẮC THIẾT KẾ (DESIGN PRINCIPLES)

### 1.1. Vấn đề cốt tử
Khi tư vấn sâu bệnh cho nông dân, các LLM thông thường dễ bị **ảo giác (hallucination)**: bịa đặt tên hoạt chất hóa học, nhầm lẫn tỷ lệ pha chế hoặc gợi ý các loại thuốc đã bị Cục BVTV cấm lưu hành. Nếu chỉ dùng Dense Vector Search thuần túy với model tiếng Anh mặc định, các tên thuốc chuyên ngành tiếng Anh/Việt (như *Mancozeb*, *Metalaxyl*, *Difenoconazole*...) rất dễ bị trôi vector embedding và tìm ra đoạn văn không liên quan.

### 1.2. Chuyển dịch Kiến trúc: Từ "Full-Content RAG" sang "Curated Knowledge RAG"
Dự án **tuyệt đối không sao chép toàn văn 100% bài viết thô (Full-content)** từ các website bên ngoài để tránh:
* Vi phạm quyền tác giả (sao chép nguyên văn tác phẩm theo Điều 20 & 28 Luật SHTT).
* Rước rác HTML, menu điều hướng, quảng cáo và nguy cơ chèn mã độc vào ngữ cảnh AI (Indirect Prompt Injection).
* Lỗ hổng bảo mật SSRF (Server-Side Request Forgery) khi cho server tải URL tự do.

Thay vào đó, hệ thống triển khai mô hình **Curated Knowledge RAG (Tri thức tinh tuyển có kiểm định & trích dẫn học thuật)**:
1. **Thu thập & Bóc tách có cấu trúc**: AI hỗ trợ Admin bóc tách bài viết thành các **đơn vị tri thức có ý nghĩa (Semantic Units)**:
   - Triệu chứng nhận biết (`symptoms`)
   - Nguyên nhân & điều kiện phát sinh (`causes`)
   - Biện pháp canh tác & phòng ngừa IPM (`prevention`)
   - Phác đồ điều trị, hoạt chất khuyến nghị & thời gian cách ly PHI (`treatment`)
   - Đoạn trích dẫn nguyên văn ngắn (`evidence_text` ~300-500 ký tự) làm bằng chứng khoa học đối chứng.
   - Link bài viết gốc (`source_url`) phục vụ minh bạch nguồn gốc (Academic Citation theo Điều 25 Luật SHTT).
2. **Kiểm duyệt có con người tham gia (Human-in-the-Loop - HITL)**:
   - Mọi tri thức nạp vào hệ thống đều ở trạng thái chờ duyệt (`pending`).
   - Bác sĩ Cây trồng / Admin thẩm định tính chính xác của hoạt chất và thời gian cách ly $\rightarrow$ Bấm nút `Duyệt` (`IsManualApproved = true`).
3. **Phân định rõ ranh giới Microservices**:
   - **PostgreSQL là Nguồn Sự Thật Duy Nhất (SSOT)**: Quản lý bởi `core-api`.
   - **Agent Service (Python) là Read-Only khi Chat**: Chỉ có quyền đọc dữ liệu phục vụ nông dân hỏi đáp.
   - **Cơ chế tái tạo chỉ mục (Reindex)**: Khi Admin duyệt bài trên Web, `core-api` gọi endpoint nội bộ `POST /internal/reindex` trên `agent-service` để cập nhật chỉ mục ChromaDB và BM25.

---

## 2. XỬ LÝ ĐA NGÔN NGỮ & RETRIEVAL (MULTILINGUAL STRATEGY)

Hệ thống lưu trữ nguồn tri thức từ cả **Việt Nam** (Cục BVTV, Viện BVTV) và **Quốc tế** (Cornell Extension, UC Davis, FAO):

| Khía cạnh | Chiến lược xử lý | Chi tiết kỹ thuật |
|---|---|---|
| **Lưu trữ CSDL** | Giữ nguyên bản ngữ gốc của bằng chứng | `evidence_text` và `source_url` giữ nguyên ngôn ngữ gốc (Anh/Việt) để đảm bảo tính khách quan khoa học; các trường tóm tắt (`knowledge_content`, `prevention`) luôn có bản tiếng Việt chuẩn. |
| **Vector Embedding** | Dùng Model Đa ngôn ngữ (Multilingual) | **`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`** (chạy local trên CPU, nhẹ, hỗ trợ >50 ngôn ngữ bao gồm Tiếng Việt & Tiếng Anh). Ánh xạ câu hỏi tiếng Việt và tài liệu tiếng Anh về cùng một vùng không gian vector (Cross-lingual Semantic Search). |
| **BM25 Okapi** | So khớp từ khóa & Hoạt chất | Tiền xử lý chữ thường (lowercase), loại bỏ ký tự đặc biệt, lập chỉ mục song ngữ trên tên cây trồng, tên bệnh và danh mục hoạt chất quốc tế (*Mancozeb, Metalaxyl, Trichoderma...*). |
| **Hợp nhất Hybrid RRF** | Reciprocal Rank Fusion | $RRF(d) = \sum \frac{1}{60 + rank_i(d)}$. Cân bằng giữa tìm kiếm từ khóa chính xác (BM25) và tìm kiếm theo ngữ nghĩa mô tả triệu chứng (Vector). |
| **Đầu ra LLM** | Tổng hợp tiếng Việt 100% | System Prompt chỉ thị LLM: đọc hiểu ngữ cảnh đa ngữ nhưng **luôn tổng hợp câu trả lời cho nông dân bằng tiếng Việt** chuẩn mực, dễ hiểu, đậm chất khuyến nông. |

---

## 3. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)

### Cấu trúc Module RAG (`backend/agent-service/app/rag/`):
```
backend/agent-service/app/rag/
├── __init__.py
├── schema.py              # Định nghĩa Pydantic Models cho CuratedKnowledge, SemanticChunk, RetrievalResult
├── extractor.py           # Tiện ích bóc tách bài viết/URL thành các khối tri thức ngữ nghĩa
├── bm25_retriever.py      # Bộ tìm kiếm từ khóa chính xác BM25 Okapi hỗ trợ tiền xử lý tiếng Việt
├── vector_retriever.py    # Bộ tìm kiếm Vector sử dụng paraphrase-multilingual-MiniLM-L12-v2 + ChromaDB
├── hybrid_fusion.py       # Thuật toán Reciprocal Rank Fusion (RRF k=60)
├── sync_index.py          # Script đọc Postgres SSOT và tái tạo toàn bộ chỉ mục ChromaDB + BM25
└── pipeline.py            # Facade API cấp cao cho MCP Tool lookup_disease_knowledge & endpoint /internal/reindex
```

### Cấu trúc Document trong ChromaDB:
Mỗi đoạn tri thức được đánh chỉ mục theo từng đơn vị ngữ nghĩa (`semantic_unit`):
```json
{
  "id": "chunk_tomato_late_blight_treatment",
  "document": "Biện pháp hóa học: Sử dụng các hoạt chất Mancozeb, Metalaxyl-M để phòng trị mốc sương. Thời gian cách ly an toàn tối thiểu 7 ngày. Không phun khi trời sắp mưa to để tránh rửa trôi.",
  "metadata": {
    "postgres_id": "c1f7a83b-9a2e-4b6a-81a1-8d4e9f123456",
    "disease_code": "Tomato___Late_blight",
    "crop_type": "Tomato",
    "plant_name_vi": "Cà chua",
    "disease_name_vi": "Bệnh mốc sương cà chua",
    "semantic_unit": "treatment",
    "active_ingredients": "Mancozeb, Metalaxyl-M",
    "is_allowed": true
  }
}
```

### Tiêu chuẩn đầu ra của RAG Context cho Agent:
Khi Agent tra cứu qua `lookup_disease_knowledge(disease_code, query)`:
```json
{
  "disease_code": "Tomato___Late_blight",
  "disease_name": "Bệnh Mốc sương cà chua",
  "pathogen": "Phytophthora infestans",
  "approved_ingredients": ["Mancozeb", "Metalaxyl-M", "Dimethomorph"],
  "standard_phi_days": 7,
  "is_allowed": true,
  "top_chunks": [
    {
      "text": "Phun phòng ngừa bằng Mancozeb khi thời tiết ẩm ướt kéo dài. Nếu đã chớm bệnh chuyển sang Metalaxyl...",
      "source_title": "Cẩm nang Phòng trừ Sâu bệnh Cà chua - Cục BVTV",
      "source_url": "https://ppd.gov.vn/...",
      "rrf_score": 0.0328
    }
  ],
  "prevention_steps": [
    "Cắt tỉa lá già sát gốc tạo độ thông thoáng",
    "Không tưới phun mưa vào chiều muộn khi trời ẩm"
  ]
}
```

---

## 4. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)

- [ ] **Pha 1 (Thành viên A & B - Postgres SSOT & Schema)**:
  - Thành viên A cập nhật bảng `KnowledgeSources` trong CSDL: thêm các cột `DiseaseCode (VARCHAR)`, `ActiveIngredients (TEXT[])`, `PhiDays (INT)`, `IsAllowed (BOOLEAN)`, `KnowledgeContent (TEXT)`, `EvidenceText (TEXT)`, `SourceUrl (TEXT)`, `IsManualApproved (BOOLEAN)`.
  - Thành viên B tạo `schema.py` định nghĩa các model Pydantic tương ứng.
- [ ] **Pha 2 (Thành viên B - Module Bóc tách & Seed 5 Bệnh Demo)**:
  - Viết `extractor.py`: Hỗ trợ bóc tách bài viết thành các khối tri thức ngữ nghĩa (`symptoms`, `causes`, `prevention`, `treatment`, `evidence`).
  - Chuẩn bị dữ liệu mẫu đã kiểm duyệt (`IsManualApproved = true`) cho 5 bệnh demo hạt nhân:
    1. `Tomato___Late_blight` (Mốc sương cà chua)
    2. `Tomato___Early_blight` (Đốm vòng cà chua)
    3. `Tomato___Target_Spot` (Đốm mục tiêu cà chua)
    4. `Pepper,_bell___Bacterial_spot` (Đốm vi khuẩn ớt)
    5. `Corn_(maize)___Common_rust_` (Gỉ sắt ngô)
- [ ] **Pha 3 (Thành viên B - ChromaDB Đa ngôn ngữ & BM25 Tiền xử lý)**:
  - Cài đặt `vector_retriever.py` sử dụng `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` và ChromaDB cục bộ (`backend/agent-service/data/chroma_db/`).
  - Cài đặt `bm25_retriever.py` với bộ tiền xử lý chữ thường và token hóa song ngữ tên bệnh/hoạt chất.
  - Viết script `sync_index.py` đọc CSDL Postgres và tự động nạp vào ChromaDB + BM25 trong 1 lệnh CLI.
- [ ] **Pha 4 (Thành viên B - Thuật toán Hợp nhất RRF & Endpoint Reindex)**:
  - Cài đặt Reciprocal Rank Fusion ($k = 60$) tại `hybrid_fusion.py`.
  - Viết endpoint `POST /internal/reindex` trên FastAPI để `core-api` gọi kích hoạt đồng bộ khi Admin bấm duyệt bài.
- [ ] **Pha 5 (Thành viên B - Facade Pipeline & Benchmark Kiểm thử)**:
  - Hoàn thiện `pipeline.py` cung cấp interface duy nhất cho MCP Tool: `lookup_disease_knowledge(disease_code, query)`.
  - Viết script kiểm thử định lượng `test_rag_accuracy.py`: kiểm tra bộ câu hỏi đối chứng cho 5 bệnh demo, đo Recall@3 và kiểm tra độ trễ.

---

## 5. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] CSDL PostgreSQL lưu trữ đầy đủ dữ liệu tri thức có cấu trúc và đoạn trích dẫn đối chứng cho 5 bệnh demo.
- [ ] Script `sync_index.py` và endpoint `POST /internal/reindex` tái tạo thành công ChromaDB và BM25 từ Postgres mà không bị lỗi.
- [ ] Độ chính xác truy vấn: 100% câu hỏi đối chứng về triệu chứng và hoạt chất của 5 bệnh demo trả về đúng tài liệu chuẩn trong Top-3 kết quả (Recall@3 = 100%).
- [ ] Mô hình embedding đa ngôn ngữ hỗ trợ truy vấn chéo (câu hỏi tiếng Việt tìm trúng tài liệu có thuật ngữ/tên khoa học tiếng Anh).
- [ ] Thời gian truy xuất Hybrid Retrieval $\le 200$ms trên CPU cục bộ.
