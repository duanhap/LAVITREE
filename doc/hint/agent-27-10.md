

# 6. Kho `extract/` là gì và tích hợp ra sao

**Bản chất:** đây là ghi chép của bạn từ khóa học AI 27 ngày. Mỗi DAY có một báo cáo, trả lời 4 câu trong `huongdan.md` (cuối báo cáo có mục "bắt buộc / có thể / không nên"), kèm **các file Python prototype chạy độc lập**, dùng dữ liệu giả và gọi Gemini/OpenAI.

👉 Vì vậy **không thể copy nguyên vào LAVITREE**. Nên coi nó là **bản thiết kế và code mẫu**: mỗi lần lấy một module, thay dữ liệu giả bằng lời gọi Core API hoặc DB, rồi đặt vào đúng service.

| Dùng ở đâu | DAY nên lấy | Lấy cái gì cụ thể |
|---|---|---|
| **Sprint 1 – luồng Vision** | DAY12 | Dockerfile multi-stage, healthcheck (liveness/readiness), cấu hình qua biến môi trường |
| | DAY10 | Kiểm tra chất lượng 2 file CSV trước khi seed (thiếu cột, trùng mã lớp…) |
| | DAY2 | Ranh giới AI: khi nào từ chối, khi nào cảnh báo (áp vào `is_uncertain`) |
| **Sprint 2 – Agent** (cốt lõi) | **DAY3** | `lavitree_mcp_server.py` và `lavitree_react_agent.py`: **nền trực tiếp cho agent-service** |
| | DAY26 | Chuẩn hóa 4 tool theo MCP |
| | DAY4 | Viết prompt và tool schema; chặn ghi (Agent không được tự tạo đơn) |
| | DAY2, DAY11, DAY27 | Guardrail PHI, HITL (`[DRAFT_RECOMMENDATION]`), router chuyển chế độ khi mất mạng |
| | DAY7, DAY8, DAY18 | RAG trên 112 nguồn, hybrid BM25 + vector (BM25 bắt tốt tên thuốc như *Mancozeb*) |
| | DAY25 | Circuit breaker và cache: khi LLM hoặc API thời tiết lỗi thì không sập |
| | DAY1, DAY13 | SSE streaming, trace waterfall, log |
| **Báo cáo đồ án** | DAY5_6 | PRD, ROI, phân tích rủi ro (chương 1–2) |
| | DAY14, DAY24 | Bộ test đánh giá Agent, LLM-as-judge (chương thực nghiệm) |
| **⚪ Bỏ, quá sức đồ án** | DAY9, 16, 17, 19, 20, 21, 22, 23 | Multi-agent, GraphRAG, fine-tune LLM, DPO, LangGraph: chỉ nhắc ở phần "hướng phát triển" |

Nói gọn: **DAY3 là xương sống của Agent**. DAY2, 4, 11, 26, 27 là phần an toàn bọc quanh nó. DAY7, 8, 18 là phần tri thức. DAY12, 13, 25 là phần vận hành. Các DAY còn lại chỉ để tham khảo.
