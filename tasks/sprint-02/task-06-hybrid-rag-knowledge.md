# TASK-06: TẦNG TRI THỨC HYBRID RAG (BM25 + DENSE VECTOR) TRÊN 112 NGUỒN KHUYẾN NÔNG
* **Sprint**: Sprint 2 (Trí tuệ Nhân tạo Tác tử & Hệ sinh thái MCP)
* **Phân hệ**: `backend/agent-service/app/rag/`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (RAG & NLP) & Thành viên A (Database Setup)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Kế thừa từ nguyên mẫu**: `extract/DAY18/lavitree_production_rag_pipeline.py` & `extract/KnowledgeSources_rows.csv`

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề cốt tử**: Khi tư vấn sâu bệnh cho nông dân, các LLM thông thường dễ bị **ảo giác (hallucination)**: bịa đặt tên hoạt chất hóa học, nhầm lẫn tỷ lệ pha chế hoặc gợi ý các loại thuốc đã bị Cục BVTV cấm lưu hành. Nếu chỉ dùng Dense Vector Search thuần túy, các tên thuốc chuyên ngành tiếng Anh/Việt (như *Mancozeb*, *Metalaxyl*, *Difenoconazole*...) rất dễ bị trôi vector embedding và tìm ra đoạn văn không liên quan.
- **Giải pháp kế thừa từ DAY7, 8, 18**: Triển khai kiến trúc **Hybrid Retrieval**:
  - **BM25 Search (Keyword Matching)**: Bắt chính xác 100% các từ khóa chuyên ngành, tên hoạt chất, liều lượng pha (ví dụ: *50g/bình 16 lít*).
  - **Dense Vector Search (Semantic Matching)**: Bắt ngữ nghĩa mô tả biểu hiện bệnh tật từ nông dân (ví dụ: *"lá cà chua bị đốm đen úng nước sau mưa"* $\rightarrow$ tìm ra bệnh Mốc sương / Late Blight).
  - **Reciprocal Rank Fusion (RRF)**: Thuật toán hợp nhất thứ hạng chuẩn công nghiệp để lấy ra Top-3 đoạn văn bản khuyến nông chuẩn xác nhất cấp cho Agent.
- **Nguồn dữ liệu**: File `backend/core-api/seed/KnowledgeSources_rows.csv` chứa 112 tài liệu khuyến nông đã kiểm duyệt.

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)

### Cấu trúc Module RAG:
```
backend/agent-service/app/rag/
├── __init__.py
├── chunker.py             # Phân đoạn tài liệu khuyến nông có giữ metadata (bệnh, hoạt chất, PHI)
├── bm25_retriever.py      # Bộ tìm kiếm BM25 Okapi trên từ khóa hoạt chất
├── vector_retriever.py    # Bộ tìm kiếm Vector (sử dụng Sentence-Transformers hoặc OpenAI embeddings)
├── hybrid_fusion.py       # Hợp nhất RRF: RRF_score(d) = sum(1 / (60 + rank_i(d)))
└── pipeline.py            # API cấp cao cho tool lookup_disease_knowledge
```

### Tiêu chuẩn đầu ra của RAG Context:
Mỗi khi Agent tra cứu, RAG trả về đối tượng có cấu trúc:
```json
{
  "disease_name": "Bệnh Mốc sương cà chua",
  "pathogen": "Phytophthora infestans",
  "approved_ingredients": ["Mancozeb", "Metalaxyl-M", "Dimethomorph"],
  "standard_phi": 7,
  "prevention_steps": [
    "Cắt tỉa lá già sát gốc",
    "Không tưới phun mưa vào chiều tối"
  ],
  "source_citation": "Cẩm nang Khuyến nông Quốc gia - Cục Trồng trọt"
}
```

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1 (Thành viên A & B)**: Chuẩn bị dữ liệu: Làm sạch file `KnowledgeSources_rows.csv` (112 hàng), phân đoạn mỗi bài thành các chunks nhỏ (300-500 tokens) gắn nhãn `crop`, `disease_code`.
- [ ] **Pha 2 (Thành viên B)**: Cài đặt `bm25_retriever.py` sử dụng thư viện `rank-bm25`, lập chỉ mục toàn bộ danh mục hoạt chất và tên bệnh.
- [ ] **Pha 3 (Thành viên B)**: Cài đặt `vector_retriever.py` tạo vector embeddings cho các chunks và lưu trữ trong ChromaDB cục bộ hoặc PGvector Supabase.
- [ ] **Pha 4 (Thành viên B)**: Viết thuật toán hợp nhất `hybrid_fusion.py` (RRF với hằng số $k = 60$).
- [ ] **Pha 5 (Thành viên B)**: Tích hợp RAG Pipeline vào MCP Tool `lookup_disease_knowledge`.
- [ ] **Pha 6**: Viết script `test_rag_accuracy.py` kiểm tra 10 câu hỏi thử thách: Bắt buộc tìm ra đúng tên hoạt chất khuyến nghị cho các bệnh nguy hiểm (Đốm lá ngô, Mốc sương cà chua, Thán thư ớt...).

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Module RAG nạp thành công 112 tài liệu khuyến nông vào hệ thống.
- [ ] Độ chính xác truy vấn hoạt chất: 10/10 ca thử nghiệm tìm kiếm hoạt chất bằng tên thương phẩm đều trả về đúng hoạt chất đối chứng (Accuracy 100%).
- [ ] Thời gian truy xuất Hybrid Retrieval $\le 200$ms trên CPU cục bộ.
- [ ] Bằng chứng nghiệm thu: Log chạy `test_rag_accuracy.py` thể hiện Top-3 kết quả truy xuất có trích dẫn nguồn văn bản đối chứng.
