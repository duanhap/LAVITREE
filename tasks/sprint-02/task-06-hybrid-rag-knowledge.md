# TASK-06: TẦNG TRI THỨC HYBRID RAG (BM25 + CHROMADB) & PIPELINE NẠP DỮ LIỆU KIỂM ĐỊNH (HITL)
* **Sprint**: Sprint 2 (Trí tuệ Nhân tạo Tác tử & Hệ sinh thái MCP)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 1 (Làm đầu tiên để có dữ liệu cho các Task 05, 07, 08)**
* **Phân hệ**: `backend/agent-service/app/rag/` & CSDL `backend/core-api`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (RAG Pipeline & ChromaDB) & Thành viên A (PostgreSQL Schema & Seed)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Kế thừa từ nguyên mẫu**: `extract/DAY18/lavitree_production_rag_pipeline.py` & `extract/KnowledgeSources_rows.csv`

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề cốt tử**: Khi tư vấn sâu bệnh cho nông dân, các LLM thông thường dễ bị **ảo giác (hallucination)**: bịa đặt tên hoạt chất hóa học, nhầm lẫn tỷ lệ pha chế hoặc gợi ý các loại thuốc đã bị Cục BVTV cấm lưu hành. Nếu chỉ dùng Dense Vector Search thuần túy, các tên thuốc chuyên ngành tiếng Anh/Việt (như *Mancozeb*, *Metalaxyl*, *Difenoconazole*...) rất dễ bị trôi vector embedding và tìm ra đoạn văn không liên quan.
- **Giải pháp Kiến trúc Chuẩn Doanh nghiệp**:
  1. **PostgreSQL là Nguồn Sự Thật Duy Nhất (SSOT) — Mô hình Hybrid Document-Relational**:
     - Thay vì xé nhỏ bài viết thành hàng chục cột quan hệ cứng hoặc lưu rời rạc vào Vector DB dẫn đến mất ngữ cảnh và rủi ro lệch pha (Dual-Write drift), PostgreSQL lưu trữ 2 phần song song:
       - **Các trường có cấu trúc (Structured Fields)**: Dùng cho lọc cứng SQL (`disease_code`, `active_ingredients TEXT[]`, `phi_days INT`, `is_allowed BOOLEAN`, `status VARCHAR`).
       - **Trường văn bản thô & Chunks (Unstructured Text & Chunks)**: `full_content TEXT` (lưu trọn vẹn 100% nội dung gốc bài viết từ URL) và `chunks JSONB` (danh sách các đoạn văn bản 300–500 ký tự kèm thứ tự).
     - **ChromaDB cục bộ và BM25 Okapi** chỉ đóng vai trò là các **chỉ mục phái sinh có thể tái tạo (rebuildable indexes)** từ bảng PostgreSQL bất kỳ lúc nào.
  2. **Quy trình Nạp Tri thức có Kiểm định (Admin AI Extraction + Human-in-the-loop Ingestion)**:
     - Admin dán URL/văn bản bài viết khuyến nông $\rightarrow$ AI hỗ trợ trích xuất sơ bộ thành bản ghi dạng bảng tạm (Staging với trạng thái `pending`).
     - Bác sĩ Cây trồng / Admin rà soát tên hoạt chất, liều lượng và thời gian cách ly PHI $\rightarrow$ Bấm nút `Duyệt` (`IsManualApproved = true`).
     - Khi bài viết được duyệt, hệ thống tự động băm chunks, sinh vector embeddings và lập chỉ mục vào **ChromaDB cục bộ** (`backend/agent-service/data/chroma_db`) và **BM25 Okapi**.
  3. **Phạm vi Trọng tâm Demo (5 Ca bệnh Lâm sàng Hạt nhân)**:
     - Để đảm bảo chất lượng tri thức tuyệt đối và kịp tiến độ tuần 2, toàn bộ dữ liệu RAG tập trung làm sâu và chuẩn xác cho 5 bệnh đại diện:
       1. `Tomato___Late_blight` (Mốc sương cà chua)
       2. `Tomato___Early_blight` (Đốm vòng cà chua)
       3. `Tomato___Target_Spot` (Đốm mục tiêu cà chua)
       4. `Pepper__bell___Bacterial_spot` (Đốm vi khuẩn / Thán thư ớt)
       5. `Corn_(maize)___Common_rust_` (Gỉ sắt ngô)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)

### Cấu trúc Module RAG (`backend/agent-service/app/rag/`):
```
backend/agent-service/app/rag/
├── __init__.py
├── schema.py              # Định nghĩa Pydantic Models cho Article, Chunk, StructuredMetadata
├── ingest.py              # Pipeline trích xuất AI từ URL/Văn bản -> Staging -> Sync Postgres
├── chunker.py             # Phân đoạn văn bản (Recursive Character 400 chars, overlap 50) kèm metadata
├── bm25_retriever.py      # Bộ tìm kiếm từ khóa chính xác BM25 Okapi trên hoạt chất & tên bệnh
├── vector_retriever.py    # Bộ tìm kiếm Vector ngữ nghĩa sử dụng ChromaDB cục bộ (Persistent)
├── hybrid_fusion.py       # Hợp nhất Reciprocal Rank Fusion: RRF_score(d) = sum(1 / (60 + rank_i(d)))
├── sync_index.py          # Script đọc Postgres SSOT và tái tạo chỉ mục ChromaDB + BM25 trong 1 lệnh
└── pipeline.py            # Facade API cấp cao cho MCP Tool lookup_disease_knowledge
```

### Cấu trúc Metadata trong ChromaDB:
Mỗi đoạn văn bản (Chunk) được lưu trong ChromaDB với metadata trỏ ngược về PostgreSQL:
```json
{
  "id": "chunk_tomato_late_blight_01",
  "document": "Nguyên nhân do nấm Phytophthora infestans phát triển mạnh khi trời mưa ẩm, sương mù nhiều. Triệu chứng lá xuất hiện đốm úng nước...",
  "metadata": {
    "postgres_id": "c1f7a83b-9a2e-4b6a-81a1-8d4e9f123456",
    "disease_code": "Tomato___Late_blight",
    "crop_type": "Tomato",
    "active_ingredients": "Mancozeb, Metalaxyl-M, Dimethomorph",
    "is_allowed": true,
    "chunk_index": 1
  }
}
```

### Tiêu chuẩn đầu ra của RAG Context cho Agent:
Mỗi khi Agent tra cứu qua `lookup_disease_knowledge`, RAG trả về đối tượng có cấu trúc kết hợp trích dẫn:
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
      "chunk_text": "Phun phòng ngừa bằng Mancozeb khi thời tiết ẩm ướt kéo dài. Nếu đã chớm bệnh chuyển sang Metalaxyl...",
      "source_title": "Cẩm nang Phòng trừ Sâu bệnh Cà chua - Cục BVTV",
      "rrf_score": 0.0328
    }
  ],
  "prevention_steps": [
    "Cắt tỉa lá già sát gốc tạo độ thông thoáng",
    "Không tưới phun mưa vào chiều muộn khi trời sắp mưa"
  ]
}
```

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)

- [ ] **Pha 1 (Thành viên A & B - Postgres SSOT Setup)**:
  - Thành viên A cập nhật entity `KnowledgeSource` (hoặc bảng chuyên biệt) trong CSDL: thêm `RawContent (TEXT)`, `Chunks (JSONB)`, `ActiveIngredients (TEXT[])`, `DiseaseCode (VARCHAR)`.
  - Thành viên B tạo `schema.py` định nghĩa các cấu trúc dữ liệu Pydantic.
- [ ] **Pha 2 (Thành viên B - Ingestion & AI Extraction Script)**:
  - Viết `ingest.py`: Hàm hỗ trợ Admin nhận URL hoặc bài viết thô, dùng Gemini 2.0 bóc tách các trường lọc cứng và cắt nhỏ văn bản thành chunks JSONB.
  - Tạo dữ liệu chuẩn hóa và được duyệt (`IsManualApproved = true`) cho 5 bệnh demo hạt nhân.
- [ ] **Pha 3 (Thành viên B - ChromaDB Vector Store & BM25 Indexer)**:
  - Cài đặt `vector_retriever.py` sử dụng ChromaDB cục bộ (lưu trữ persistent tại thư mục `backend/agent-service/data/chroma_db/`).
  - Cài đặt `bm25_retriever.py` sử dụng `rank-bm25` lập chỉ mục trên tập chunks của 5 bệnh demo.
  - Viết script `sync_index.py` đọc từ Postgres và tự động nạp vào ChromaDB + BM25 (chạy độc lập 1 lệnh).
- [ ] **Pha 4 (Thành viên B - Hybrid Fusion Algorithm)**:
  - Cài đặt thuật toán Reciprocal Rank Fusion (RRF) tại `hybrid_fusion.py` với hằng số phạt $k = 60$.
  - Kiểm thử hợp nhất: câu hỏi chứa tên hoạt chất (*Mancozeb*) ưu tiên BM25; câu hỏi chứa mô tả triệu chứng (*"lá úng nước đốm nâu sau mưa"*) ưu tiên Vector.
- [ ] **Pha 5 (Thành viên B - Facade Pipeline & Acceptance Testing)**:
  - Hoàn thiện `pipeline.py` cung cấp interface duy nhất cho MCP Tool: `query_knowledge(disease_code, query_text)`.
  - Viết script kiểm thử định lượng `test_rag_accuracy.py`: kiểm tra bộ câu hỏi đối chứng cho 5 bệnh demo, đo Recall@3 và kiểm tra không lọt hoạt chất bị cấm.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] CSDL PostgreSQL lưu trữ đầy đủ dữ liệu Hybrid (trường lọc cứng + `full_content` + `chunks JSONB`) cho 5 bệnh demo.
- [ ] Script `sync_index.py` tái tạo thành công ChromaDB và BM25 từ Postgres mà không bị lỗi.
- [ ] Độ chính xác truy vấn: 100% câu hỏi đối chứng về hoạt chất đặc trị của 5 bệnh demo đều trả về đúng hoạt chất chuẩn trong Top-3 kết quả (Recall@3 = 100%).
- [ ] Thời gian truy xuất Hybrid Retrieval $\le 200$ms trên CPU cục bộ.
- [ ] Bằng chứng nghiệm thu: Log thực thi `test_rag_accuracy.py` thể hiện Top-3 kết quả truy xuất có trích dẫn rõ ràng nguồn tài liệu đối chứng.
