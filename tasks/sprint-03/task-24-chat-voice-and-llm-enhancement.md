# TASK-24: Nâng cấp trải nghiệm hội thoại Trợ lý Lavi: Tích hợp Giọng nói AI tự nhiên (Neural TTS) & Tinh chỉnh văn phong linh hoạt (LLM Model)

* **Sprint**: Sprint 3 (Nâng cao trải nghiệm người dùng & Khả năng tiếp cận)
* **Phân hệ**: `backend/agent-service`, `frontend/web` (trang Chat, tin nhắn hội thoại), `docs/architecture/api-contracts.md`
* **Trạng thái**: `[x] PHẦN 1 HOÀN TẤT` (Đã hoàn thành Giọng đọc AI Neural TTS, chuẩn bị sang Phần 2: LLM Model / Prompt)
* **Người phụ trách**: Giao cho Antigravity; nghiệm thu: Người dùng / Trưởng nhóm
* **Độ ưu tiên**: **P1** (Cải thiện trải nghiệm âm thanh và phong cách trò chuyện của Trợ lý Lavi)
* **Tạo ngày**: 23/11/2026

---

## 1. BỐI CẢNH & VẤN ĐỀ

Người dùng phản ánh:
> *"Hiện tại chat đang dùng chat gì vậy sao nghe chán quá, có cách nào hỗ trợ không (kiểu có cả tiếng Anh tiếng Việt nữa, cần nhấn nhá nữa), nên tải model khác về à hay api khác?"*

Qua rà soát hệ thống, vấn đề bắt nguồn từ 2 tầng độc lập:
1. **Tầng Giọng đọc (Audio / Text-To-Speech)**:
   - Trước đây đang dùng API mặc định của trình duyệt (`window.speechSynthesis`).
   - Đây là giọng đọc tổng hợp cơ bản của hệ điều hành (như Microsoft An trên Windows hoặc Google voice cũ). Giọng đọc đều đều, không có cảm xúc ("nhấn nhá"), và khi đọc các thuật ngữ tiếng Anh mượn (tên thuốc *Ridomil Gold*, hoạt chất *Metalaxyl*, *Mancozeb*, nấm *Phytophthora*, bệnh *Late blight*...) thì phát âm sai hoặc ngọng nghịu gây khó chịu cho người nghe.
2. **Tầng Mô hình sinh ngôn ngữ (LLM Model / Văn phong)**:
   - Mô hình đang chạy là `gemini-3.5-flash-lite` với cấu hình an toàn khắt khe: `temperature = 0.2` và system prompt yêu cầu trả lời như sách giáo khoa khuyến nông, cấm giao tiếp thân mật. Điều này khiến câu trả lời bị khô cứng, thiếu tính đối thoại tự nhiên của một người bạn đồng hành cùng nhà nông.

---

## 2. KẾ HOẠCH NÂNG CẤP (2 PHẦN)

### Phần 1: Tích hợp Giọng nói AI tự nhiên (Neural TTS) — [HOÀN TẤT]
- **Công nghệ**: Microsoft Edge Neural TTS (`edge-tts 7.3.1` trong môi trường Python của `agent-service`).
- **Giọng đọc mục tiêu**:
  - `vi-VN-HoaiMyNeural` (Nữ - Truyền cảm, ngọt ngào, có ngữ điệu nhấn nhá tự nhiên).
  - `vi-VN-NamMinhNeural` (Nam - Rõ ràng, ấm áp, mạch lạc).
- **Khả năng song ngữ**: Tự động chuyển ngữ mượt mà khi gặp các thuật ngữ tiếng Anh (tên thương mại thuốc BVTV, tên khoa học nấm, hoạt chất hóa học).
- **Backend API**:
  - Endpoint: `POST /api/v1/agent/tts`
  - Nhận `{ text: string, voice?: string, rate?: string }` và trả về luồng `audio/mpeg` (có kèm cache header 24h).
- **Frontend**:
  - Trình phát âm thanh HTML5 với bộ nhớ đệm (Blob cache `ttsAudioCache`).
  - Hỗ trợ đổi nhanh giọng Nữ (Hoài My) / Nam (Nam Minh) trực tiếp trên từng tin nhắn.
  - Cơ chế tự phục hồi (Fallback): Nếu API backend gặp sự cố mạng hoặc ngoại tuyến, tự động chuyển về `window.speechSynthesis` đảm bảo không bao giờ gián đoạn trải nghiệm của người dùng.

### Phần 2: Tinh chỉnh văn phong & Trí tuệ trả lời chat (LLM Model) — [BƯỚC TIẾP THEO]
- Tăng `temperature` từ `0.2` lên `0.6` trong `gemini_client.py` để câu trả lời sinh động, giàu cảm xúc và tự nhiên hơn.
- Cập nhật System Instruction (`AGRI_AGENT_SYSTEM_PROMPT` trong `app/agent/prompts.py`):
  - Hướng dẫn AI đóng vai "Bác sĩ cây trồng Lavi": thân thiện, gần gũi, dùng từ ngữ mộc mạc dễ hiểu với bà con nông dân.
  - Tự động đính kèm tên tiếng Anh hoặc tên khoa học trong ngoặc đơn giải thích rõ ràng khi nhắc đến bệnh và hoạt chất.
- Hỗ trợ cấu hình chuyển đổi linh hoạt giữa `gemini-2.5-flash`, `gemini-2.5-pro` hoặc `OpenAI GPT-4o`.

---

## 3. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)
- [x] Tạo đặc tả TASK-24 và ghi nhật ký `tasks/WORKLOG.md`.
- [x] Backend `agent-service`: Thêm endpoint `POST /api/v1/agent/tts` sử dụng `edge-tts` sinh âm thanh MP3 chất lượng cao.
- [x] Cấu hình Proxy `vite.config.ts` chuyển tiếp `/api/v1/agent` sang port của agent-service.
- [x] Frontend `ChatMessageItem.tsx`:
  - [x] Gọi API TTS để phát giọng đọc AI truyền cảm (Hoài My Neural / Nam Minh Neural).
  - [x] Phát âm chuẩn cả tiếng Việt có ngữ điệu và từ vựng tiếng Anh.
  - [x] Có hiệu ứng hoạt họa âm thanh trực quan khi đang phát (`VolumeX animate-pulse`, `Loader2` khi tải audio).
  - [x] Nút đổi nhanh giữa giọng Nữ và Nam.
  - [x] Tự động fallback về Web Speech nếu API bận.
- [x] `npm run build` Frontend và `tsc --noEmit` hoàn tất không có lỗi (Build pass 100% trong 9.11s).
