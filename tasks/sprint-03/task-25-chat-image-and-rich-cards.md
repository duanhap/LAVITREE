# TASK-25: Chat Lavi: hiểu ảnh người dùng gửi, hiện ảnh bệnh mẫu và thẻ sản phẩm trong câu trả lời
* **Sprint**: Sprint 3
* **Phân hệ**: `frontend/web` (trang Chat, khung tin nhắn), `backend/agent-service` (API chat, vòng ReAct, prompt), `docs/architecture/api-contracts.md` mục 4.1
* **Trạng thái**: `[ ] TODO`
* **Người phụ trách**: giao cho agent; nghiệm thu: Claude Code / trưởng nhóm
* **Độ ưu tiên**: **P1**. Riêng **Phần A0** là **P0**: hiện tại agent có thể trả lời bịa như thể đã xem ảnh.
* **Tạo ngày**: 23/11/2026
* **Ước lượng**: vừa. **Không** sửa ai-service. **Không** thêm bảng hay migration. Core chỉ dùng API có sẵn (`POST /api/v1/diagnose`, `GET /api/v1/knowledge/images`, `GET /api/v1/medicines/search`).
* **Liên quan**: TASK-20 (Sổ tay bệnh học), TASK-21 (`GET /medicines/{id}`, nếu đã merge), TASK-24 (đang sửa `prompts.py` và `ChatMessageItem.tsx`, xem mục 9), BUG-51 / BUG-106 (quy tắc `draft_order`).

---

## 1. HIỆN TRẠNG (đã xác minh bằng đọc code ngày 23/11/2026)

### 1.1. Agent không gọi ai-service, và không nhận được ảnh

- Agent có đúng 4 tool: `lookup_disease_knowledge`, `check_weather_risk`, `query_pesticide_store`, `verify_phi_safety` (`backend/agent-service/app/mcp/server.py`, khoảng dòng 159–226). Không tool nào gọi ai-service.
- Khi người dùng đính kèm ảnh trong `/chat`:
  1. `frontend/web/src/pages/ChatPage.tsx` (`handleImageFileChange`, khoảng dòng 359–381) đọc file bằng `FileReader.readAsDataURL`, tức là đổi ảnh thành chuỗi base64 `data:image/...`.
  2. `handleSend` (khoảng dòng 391–402) gửi `sendMessage(text, undefined, previewUrl)`. Nếu người dùng không gõ chữ, câu gửi đi là câu mặc định *"Lavi xem giúp mình ảnh lá cây này bị bệnh gì và cách xử lý với nhé!"*.
  3. `useAgentChat.ts` chỉ gắn `image_url` vào tin nhắn để **hiển thị**. Gói tin `payload` gửi tới `/api/v1/agent/chat` (khoảng dòng 117–123) **không có ảnh**.
  4. `ChatRequest` của agent (`backend/agent-service/app/main.py`, khoảng dòng 75–80) cũng không có trường ảnh.
- **Hậu quả:** agent chỉ nhận được câu chữ mặc định, không thấy ảnh, nên dễ trả lời bịa ra một bệnh. Với ứng dụng tư vấn thuốc bảo vệ thực vật, đây là lỗi an toàn.
- **Ảnh không được lưu ở đâu cả.** Chuỗi base64 nằm trong state React, sau đó bị ghi vào `localStorage` cùng lịch sử chat (`ChatPage.tsx`, khoảng dòng 98–104, khóa `SESSIONS_STORAGE_KEY`). Một ảnh 3–10 MB đổi sang base64 còn lớn hơn khoảng 33%, vượt hạn mức khoảng 5 MB của `localStorage`. Khi đó `setItem` ném lỗi, code chỉ `console.warn`, và **cả lịch sử chat ngừng được lưu** mà người dùng không biết.

### 1.2. Luồng Khám bệnh (`/diagnose`) đã làm đủ phần nhận diện ảnh

`POST /api/v1/diagnose` (`backend/core-api/src/Lavitree.Api/Controllers/DiagnoseController.cs`, dòng 66 trở đi):
- Nhận `multipart/form-data`, trường `image` (jpg/jpeg/png/webp/bmp, ≤ 10 MB) và `notes` (≤ 1000 ký tự). Khách vãng lai gọi được. Có rate limit `diagnose_policy`.
- Gọi ai-service, trả `DiagnoseResponseDto` (`backend/core-api/src/Lavitree.Application/DTOs/DiagnosisDtos.cs`, dòng 73 trở đi). Các trường dùng trong task này:
  - `diagnosis_id` (null với khách)
  - `is_ood`, `is_uncertain`, `warning`
  - `result.class_code`, `result.disease_name`, `result.plant_name`, `result.confidence`, `result.confusion_group`, `result.top3[]`
  - `visual_evidence.original_image_url`
- Chính sách đã có:
  - `is_ood = true`: **không** tải ảnh lên MinIO, **không** ghi bản ghi (dòng 142–145).
  - Chỉ người đã đăng nhập mới có bản ghi `DiagnosisRecords` (dòng 318).
- Frontend đã có sẵn:
  - `prepareImageForUpload` (`features/diagnose/prepare-image.ts`)
  - `getResultStatus` (`features/diagnose/status.ts`)
  - kiểu `DiagnoseResponse` (`features/diagnose/types.ts`)
  - cách gọi mẫu tại `DiagnosePage.tsx`, khoảng dòng 215–222
- Trang Khám bệnh đã chuyển sang chat bằng `/chat?class_code=...` (`DiagnosePage.tsx`, dòng 202).

### 1.3. Ảnh bệnh mẫu: agent đã lấy được, nhưng hiển thị phụ thuộc mô hình chép lại link

- `lookup_disease_knowledge` gọi `fetch_symptom_images` (`backend/agent-service/app/mcp/client.py`, dòng 115–145). Hàm này gọi `GET /api/v1/knowledge/images?model_class=...` và lấy 3 ảnh đầu (`app/mcp/tools.py`, dòng 64–71) với các trường `image_url`, `caption`, `plant_part`, `credit`.
- Core trả một **mảng** `KnowledgeImageDto`. Người không phải admin chỉ thấy ảnh đã duyệt (`KnowledgeController.cs`, dòng 2569–2650). Trong DTO còn có `source_url` và `license_note`, nhưng `client.py` đang **bỏ** hai trường này.
- Rule 10 của prompt (`app/agent/prompts.py`, dòng 14) bảo mô hình tự viết Markdown `![...](url)`, và **chỉ khi người dùng hỏi về ảnh**.
- `ChatMessageItem.tsx` (dòng 503 trở đi) hiển thị **mọi** ảnh Markdown mà mô hình viết ra. Mô hình gõ sai hoặc tự bịa URL thì ảnh vỡ, hoặc trỏ tới một trang ngoài bất kỳ.
- Cách làm đúng đã có tiền lệ với `citations`: **backend** gom dữ liệu từ kết quả tool rồi gửi thành trường riêng, không để mô hình chép lại (`api-contracts.md`, quy tắc `citations`).

### 1.4. Khung "Gợi ý đơn thuốc" và nút "Thêm vào giỏ" có giao diện nhưng không bao giờ hiện

- `react_agent.py` (dòng 210) luôn gửi `"draft_order": None` trong sự kiện `final_answer`.
- Đây là **quyết định có chủ đích**, không phải lỗi: `api-contracts.md` mục 4.1, *Quy tắc `draft_order` (chốt 08/11/2026, BUG-106)*. Trước khi xong BUG-51 (đối chiếu pháp lý danh mục thuốc), Lavi **không được tạo giỏ hàng gợi ý**. Người dùng mua qua trang Cửa hàng. BUG-51 hiện đã chuyển sang Sprint 3 và **chưa xong**.
- Khung giao diện (`ChatMessageItem.tsx`, dòng 528–566) chỉ có tên và số lượng, không có ảnh, giá, PHI hay link sang trang chi tiết.
- `handleAddToCart` (dòng 190–245):
  - tải **toàn bộ** `/medicines/search` để tìm một sản phẩm;
  - tự viết lại logic giỏ hàng `lavitree_cart_${userId}`, trùng với `StorePage.tsx` (dòng 118) và `ProductDetailPage.tsx` (dòng 87).
- Trang chi tiết công khai đã có ở `/store/:id` (`frontend/web/src/app/router.tsx`, dòng 126).

### 1.5. Lỗi phụ trong router

`router.tsx` dòng 133: `<Route path="/products/:id" element={<Navigate to="/store/:id" replace />} />`. `Navigate` không tự thay tham số, nên người dùng vào `/products/5` bị đưa tới đường dẫn có chữ `:id` nguyên văn.

---

## 2. MỤC TIÊU

1. **A0 (làm trước, P0):** ngay khi đính kèm ảnh, agent không bao giờ được trả lời như thể đã xem ảnh.
2. **A:** ảnh người dùng gửi đi qua mô hình nhận diện có sẵn (`/diagnose`). Kết quả nhận diện cùng độ tin cậy được chuyển cho agent làm ngữ cảnh. Ảnh được lưu theo đúng chính sách của `/diagnose`, không còn nằm trong `localStorage`.
3. **B:** câu trả lời về một bệnh tự kèm tối đa 3 ảnh mẫu đã duyệt, do backend chọn, có ghi nguồn và giấy phép.
4. **C:** thuốc Lavi đã nhắc trong câu trả lời (đã qua guardrail) hiện thành thẻ gợi ý sản phẩm: ảnh, tên, giá, PHI, hoạt chất, bấm vào để mở `/store/:id`. **Không cần nút "Thêm vào giỏ" trong khung chat** (tối giản giao diện, chuyển hướng sang `/store/:id` để người dùng xem chi tiết và tự đặt mua).
5. **D:** sửa redirect `/products/:id`.

---

## 3. KIẾN TRÚC ĐÃ CHỐT (không tự đổi)

```
[ChatPage] đính kèm ảnh
   │ 1. prepareImageForUpload(file)
   │ 2. POST /api/v1/diagnose (multipart, qua apiClient, kèm token nếu có)
   ▼
[Core] ─► ai-service ─► MinIO (trừ OOD) ─► DiagnoseResponseDto
   │
   │ 3a. is_ood = true  → KHÔNG gọi agent; hiện cảnh báo OOD ngay trong khung chat
   │ 3b. còn lại        → gọi agent với current_disease_code + image_context
   ▼
[agent-service] /api/v1/agent/chat
   │ đưa image_context vào ngữ cảnh ("mô hình ảnh dự đoán X, độ tin cậy Y%")
   │ vòng ReAct như cũ (guardrail PHI, chỉ thuốc is_allowed)
   ▼
final_answer: { ..., draft_order: null, reference_images: [...], suggested_products: [...] }
```

Lý do chọn cách này, ghi lại để không ai làm ngược:
- **Không gửi ảnh base64 cho agent hay cho Gemini.** Mô hình ngôn ngữ không phải mô hình nhận diện bệnh đã huấn luyện cho 38 lớp. Làm vậy vừa bỏ qua ai-service (kèm OOD, `is_uncertain`, nhóm dễ nhầm), vừa đẩy ảnh của nông dân sang dịch vụ bên ngoài, vừa làm gói tin rất nặng.
- **Không cho agent gọi thẳng ai-service.** Như thế sẽ phải viết lại kiểm tra file, rate limit, chính sách OOD và lưu MinIO, những thứ Core đã làm và đã được kiểm.
- `image_context` do trình duyệt gửi lên nên **không được tin tuyệt đối**. Điều này chấp nhận được vì `current_disease_code` hiện cũng do trình duyệt gửi (`/chat?class_code=`). Mọi chốt an toàn (thuốc `is_allowed`, PHI, xóa liều không có nguồn) vẫn chạy ở agent, không phụ thuộc giá trị này. Agent chỉ dùng nó làm ngữ cảnh và kiểm tra định dạng (mục 5.1).

---

## 4. PHẦN A0: CHẶN TRẢ LỜI BỊA (P0, làm trong commit đầu tiên)

Cho đến khi Phần A chạy được, trong `ChatPage.tsx`:
- Ảnh đính kèm **không** được gửi qua `sendMessage` như hiện nay.
- Bấm gửi khi có ảnh: gọi luồng Phần A. Nếu commit đầu chỉ làm A0 thì thay bằng một tin nhắn trợ lý cố định, không gọi agent:
  > "Lavi chưa xem được ảnh trong khung chat. Bạn dùng **Khám bệnh qua ảnh** để mô hình nhận diện, rồi bấm "Hỏi Lavi" để được tư vấn tiếp nhé."

  kèm nút sang `/diagnose`.
- Bỏ câu mặc định "Lavi xem giúp mình ảnh lá cây này bị bệnh gì…". Câu này khiến mô hình tưởng mình đang xem ảnh.

---

## 5. PHẦN A: ẢNH NGƯỜI DÙNG GỬI TRONG CHAT

### 5.1. Agent: `backend/agent-service/app/main.py`

Thêm vào `ChatRequest`:

```python
class ImageContextTop(BaseModel):
    class_code: str = Field(..., min_length=1, max_length=100)
    disease_name: str = Field("", max_length=200)
    confidence: float = Field(..., ge=0.0, le=1.0)

class ImageContext(BaseModel):
    class_code: str = Field(..., min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_(),\-]+$")
    disease_name: str = Field("", max_length=200)
    plant_name: str = Field("", max_length=100)
    confidence: float = Field(..., ge=0.0, le=1.0)
    is_uncertain: bool = False
    confusion_group: Optional[str] = Field(None, max_length=100)
    top3: List[ImageContextTop] = Field(default_factory=list, max_length=3)

class ChatRequest(BaseModel):
    ...  # giữ nguyên các trường cũ
    image_context: Optional[ImageContext] = None
```

- Trước khi viết `pattern`, mở `docs/spec/classes.md` kiểm tra ký tự thật trong 38 mã lớp, chẳng hạn `Corn_(maize)___...` có ngoặc và dấu phẩy. Pattern phải nhận **đủ** 38 mã. Có danh sách 38 lớp sẵn trong agent thì kiểm bằng danh sách đó thay cho regex.
- **Không** có trường `is_ood`: ảnh OOD thì frontend đã không gọi agent. Payload có `image_context` thì Pydantic tự bỏ qua trường lạ, không cần xử lý thêm.
- Có `image_context` mà `current_disease_code` rỗng: gán `current_disease_code = image_context.class_code`. Hai giá trị khác nhau: **ưu tiên `image_context.class_code`** và ghi log mức `info`.
- Truyền `image_context` qua `stream_react_chat` → `react_agent.run_stream(...)` → `_events(...)`, thêm một tham số `image_context: Optional[dict]`. Làm cho cả `run()` (không stream), vì cả hai dùng chung `_events()`.

### 5.2. Agent: đưa vào ngữ cảnh và prompt

Nơi `_events` / `_react_loop_events` dựng `context` cho Gemini: khi có `image_context`, thêm **một đoạn hệ thống do code sinh ra** (không ghép vào câu của người dùng):

```
[KẾT QUẢ NHẬN DIỆN ẢNH TỪ MÔ HÌNH LAVITREE]
Người dùng vừa gửi 1 ảnh. Bạn KHÔNG nhìn thấy ảnh; đây là kết quả của mô hình nhận diện:
- Dự đoán: {disease_name} trên {plant_name} (mã {class_code}), độ tin cậy {confidence:.0%}.
- Trạng thái: {CHẮC CHẮN THAM KHẢO | KHÔNG CHẮC CHẮN}{; nhóm dễ nhầm: ... nếu có}
- Các khả năng khác: {top3 dạng "tên (xx%)"}  ← chỉ ghi khi is_uncertain hoặc có confusion_group
```

Thêm rule vào `app/agent/prompts.py`. Phối hợp với TASK-24, xem mục 9:
- Không bao giờ nói "mình thấy trong ảnh…" hay mô tả chi tiết ảnh. Nói "theo kết quả nhận diện ảnh (độ tin cậy xx%)…".
- Có khối nhận diện ảnh: **bắt buộc** gọi `lookup_disease_knowledge` với `class_code` đó trước khi tư vấn.
- `KHÔNG CHẮC CHẮN` (`is_uncertain = true`):
  - nêu các khả năng trong top3;
  - khuyên chụp lại (rõ lá, đủ sáng, một lá) hoặc gửi chuyên gia;
  - **không** gọi `query_pesticide_store`, **không** nêu tên thuốc hóa học. Chỉ khuyên biện pháp canh tác / IPM chung.
- Mã lớp là `___healthy`: nói cây có vẻ khỏe theo mô hình, không gợi ý thuốc.

Ngoài prompt, thêm **chốt cứng trong code**, không chỉ dựa vào prompt: khi `image_context.is_uncertain = true`, đặt `suggested_products = []` (mục 7) dù mô hình có gọi kho thuốc.

### 5.3. Frontend: `frontend/web/src/pages/ChatPage.tsx` + `features/chat/useAgentChat.ts`

**Chọn ảnh & Cắt ảnh lá (`LeafCropper`)** (`handleImageFileChange`):
- Giữ kiểm tra loại và dung lượng (≤ 10 MB, jpg, jpeg, png, webp, bmp).
- Khi người dùng chọn file (hoặc kéo thả/dán ảnh): Mở Modal cắt ảnh `LeafCropper` (dùng lại `LeafCropper` từ `features/diagnose/components/LeafCropper.tsx` và modal `Dialog` giống `DiagnosePage.tsx`).
- Người dùng kéo các cạnh/góc hoặc chọn tỉ lệ vuông 1:1 để khoanh trọn chiếc lá/vết bệnh, loại bỏ đất, tay và nền thừa.
- Bấm xác nhận cắt ảnh (`handleCropConfirm`): nhận file đã cắt, tạo preview bằng `URL.createObjectURL(croppedFile)`, lưu vào `attachedImage = { file: croppedFile, previewUrl }`, đóng modal cắt và focus vào ô chat.
- Ảnh xem trước dùng `URL.createObjectURL(file)`, tuyệt đối không dùng `readAsDataURL` base64. Gọi `URL.revokeObjectURL` khi bỏ ảnh, khi gửi xong và khi unmount.

**Gửi** (`handleSend` → hàm mới trong `useAgentChat`, ví dụ `sendImageMessage(text, file)`):
1. Thêm ngay tin nhắn người dùng: `image_url` = object URL tạm, đánh dấu `image_status: 'uploading'`. Thêm bong bóng trợ lý ở trạng thái "Đang phân tích ảnh…".
2. `const prepared = await prepareImageForUpload(file)` rồi gửi `FormData` với `image` (và `notes` = câu người dùng gõ, cắt ≤ 1000 ký tự) qua `apiClient.post<DiagnoseResponse>('/diagnose', formData, ...)`, giống `DiagnosePage.tsx`, khoảng dòng 215–222. Dùng chung `AbortController` với chat để nút Dừng hủy được cả bước này.
3. Có kết quả:
   - Cập nhật tin nhắn người dùng: `image_url = visual_evidence.original_image_url` (URL MinIO), `image_status: 'done'`. Thu hồi object URL. OOD thì không có URL MinIO: đặt `image_url = undefined`, `image_status: 'not_stored'`, và hiện chữ "Ảnh không được lưu".
   - Gắn vào bong bóng trợ lý `image_diagnosis` gồm `status = getResultStatus(...)`, `disease_name`, `plant_name`, `confidence`, `warning`, `diagnosis_id`.
4. `is_ood = true`:
   - **Không gọi agent.**
   - Bong bóng trợ lý hiện `warning` của Core, hoặc câu "Ảnh này có vẻ không phải lá của các cây Lavitree hỗ trợ (…)". Lấy danh sách cây từ `docs/spec/classes.md`, không tự đoán.
   - Kèm gợi ý chụp lại.
   - Kết thúc lượt.
5. Không phải OOD: gọi luồng chat cũ với:
   - `message`: chữ người dùng gõ. Nếu trống thì dùng câu trung tính *"Mình vừa gửi ảnh lá cây, Lavi tư vấn giúp mình theo kết quả nhận diện nhé."*
   - `current_disease_code`: `result.class_code`
   - `image_context`: dựng từ `result` (đúng tên trường ở mục 5.1)
6. Lỗi `/diagnose`:
   - 400 / 422: hiện `detail` của Core.
   - 429: "Bạn đã gửi quá nhiều ảnh, thử lại sau ít phút".
   - 502 / mạng: "Chưa phân tích được ảnh (dịch vụ nhận diện đang bận)".
   - Hiện lỗi trong bong bóng trợ lý, **không gọi agent**, giữ chữ người dùng đã gõ để gửi lại.

**Hiển thị kết quả nhận diện** (`ChatMessageItem.tsx`): phía trên câu trả lời của trợ lý có thẻ nhỏ "Kết quả nhận diện ảnh":
- Dùng lại `ResultStatusBadge` (`features/diagnose/components/ResultStatusBadge.tsx`).
- Hiện tên bệnh, tên cây, độ tin cậy dạng phần trăm.
- `is_uncertain` thì hiện câu cảnh báo.
- Có `diagnosis_id` (đã đăng nhập): link "Xem chi tiết ca chẩn đoán". Trước khi viết link, xem `router.tsx` để biết đường dẫn trang lịch sử ca chẩn đoán đang dùng.

**Lưu lịch sử** (`ChatPage.tsx`, khoảng dòng 98–104):
- Trước khi `localStorage.setItem`, loại khỏi mọi tin nhắn các `image_url` bắt đầu bằng `data:` hoặc `blob:`. Chỉ giữ URL `http(s)`.
- Khi `setItem` vẫn ném lỗi hết dung lượng: bỏ dần phiên cũ nhất rồi thử lại, và hiện `toast` một lần. Không im lặng.
- **Chuyển đổi dữ liệu cũ**: lúc đọc `SESSIONS_STORAGE_KEY`, xóa các `image_url` dạng `data:` có sẵn rồi ghi lại, để người đã bị đầy `localStorage` lưu được lịch sử trở lại.

### 5.4. Cập nhật kiểu dữ liệu

`features/chat/types.ts`:
- `ChatMessage.image_status?: 'uploading' | 'done' | 'not_stored' | 'error'`
- `ChatMessage.image_diagnosis?: {...}`
- `reference_images?: ReferenceImage[]`
- `suggested_products?: SuggestedProduct[]`

---

## 6. PHẦN B: ẢNH BỆNH MẪU TRONG CÂU TRẢ LỜI

### 6.1. Agent: `app/mcp/client.py` (`fetch_symptom_images`)

- Giữ thêm `source_url` và `license_note` từ `KnowledgeImageDto`.
- **Chỉ nhận** `image_url` bắt đầu bằng `https://`, hoặc bằng đúng tiền tố `MINIO_PUBLIC_URL` / đường dẫn tương đối Core trả về. Bỏ `http://` và `data:`.
- Không đổi số ảnh lấy về. `tools.py` vẫn cắt `[:3]`.

### 6.2. Agent: gom ảnh ở `react_agent.py`

- Trong nhánh `elif fn_name == "lookup_disease_knowledge"` (khoảng dòng 482–484, nơi đang gom `citations`): gom `tool_data["reference_images"]` vào `collected_images`, khử trùng theo `image_url`, tối đa 3.
- Chỉ lấy ảnh của bệnh **được tư vấn chính**: `disease_code` của lượt, hoặc `image_context.class_code`. Mô hình tra 2 bệnh thì chỉ lấy ảnh của bệnh chính. Lọc theo `disease_code` trong `fn_args` của lần gọi tool đó, vì `fetch_symptom_images` vốn lấy ảnh theo đúng mã này.
- Thêm `"reference_images": collected_images` vào sự kiện `final_answer` (khoảng dòng 207–215) **và** vào `AgentResponse.to_dict()` cho `run()` không stream.
- Chế độ offline (`_offline_events`) và lượt bị guardrail chặn: `reference_images: []`.

### 6.3. Prompt

- **Xóa rule 10** trong `prompts.py` (dòng 14), thay bằng: *"Ảnh minh họa triệu chứng sẽ được hệ thống tự hiển thị bên dưới câu trả lời. KHÔNG tự viết Markdown hình ảnh và KHÔNG viết URL ảnh. Nếu tra cứu không có ảnh, có thể nói chưa có ảnh mẫu và gợi ý xem Sổ tay bệnh học."*

### 6.4. Frontend: `ChatMessageItem.tsx`

- Component mới `features/chat/ReferenceImageGallery.tsx`, đặt dưới nội dung trả lời, trên khối nguồn tài liệu:
  - lưới 1–3 ảnh (`loading="lazy"`, `object-cover`, bo góc), dưới mỗi ảnh là `caption`;
  - dòng nhỏ "Ảnh: {credit} · {license_note}" và link "Nguồn" mở `source_url` (`target="_blank" rel="noopener noreferrer"`);
  - bấm ảnh mở lightbox. Có `Dialog` trong `components/ui` thì dùng, không thì mở ảnh ở tab mới như hiện nay;
  - ảnh lỗi tải (`onError`) thì ẩn ô đó. Cả 3 lỗi thì ẩn cả khối;
  - link "Xem thêm trong Sổ tay bệnh học". Lấy route trang chi tiết bệnh của TASK-20 trong `router.tsx` (dạng `/handbook/:classCode`).
- **Siết bộ hiển thị ảnh Markdown** (dòng 503): chỉ vẽ `<img>` khi `src` nằm trong `message.reference_images`. Ngoài danh sách thì hiện link chữ thay cho ảnh. Như vậy mô hình có lỡ viết Markdown ảnh cũng không tải được ảnh lạ.

### 6.5. Kiểm tra trước khi kết luận "ảnh hiện được trên production"

- Ảnh admin tải lên MinIO có URL `{MINIO_PUBLIC_URL}/lavitree-images/...` (`KnowledgeController.cs`, dòng 2150 và 2626–2628). Nhưng `frontend/web/nginx.conf` chỉ có `location /lavitree-diagnoses/`, **không có** `/lavitree-images/`.
- Phải mở thật một ảnh mẫu cà chua do admin tải lên (không phải ảnh dán link https ngoài) trên production và ghi kết quả.
  - Ảnh không tải được: **báo trưởng nhóm**, không tự sửa nginx trong task này. Tách thành lỗi riêng.
  - Ảnh tải được: ghi lại URL mẫu (đã che phần khóa nếu có) làm bằng chứng.

---

## 7. PHẦN C: THẺ SẢN PHẨM TRONG CÂU TRẢ LỜI

### 7.1. Ràng buộc từ BUG-106 & Tinh gọn giao diện (đọc kỹ)

- `draft_order` **giữ nguyên `null`**. Không đổi quy tắc trong `api-contracts.md`.
- Thêm trường mới `suggested_products`: danh sách **thẻ gợi ý sản phẩm để xem**, không phải giỏ hàng gợi ý, không có số lượng.
- **Không hiển thị nút "Thêm vào giỏ" trong khung chat**: Thẻ sản phẩm chỉ hiển thị trực quan thông tin thuốc (ảnh, tên, hoạt chất, số ngày cách ly, giá lấy từ Core). Người dùng bấm vào thẻ sẽ chuyển thẳng sang `/store/:id` để xem thông tin chi tiết và tự đặt mua. Điều này vừa giúp giao diện chat gọn gàng, vừa tuân thủ tuyệt đối quy định an toàn pháp lý BUG-106.

### 7.2. Agent: dựng `suggested_products` ở `react_agent.py`

Ngay sau `post_filter_response(...)` và `strip_unsourced_dosage(...)`, tức là dùng **câu trả lời cuối cùng đã qua guardrail**:

```python
def build_suggested_products(final_answer_text, allowed_medicines, *, is_fallback_catalog, image_uncertain, guardrail_blocked):
    if is_fallback_catalog or image_uncertain or guardrail_blocked:
        return []
    answer_lower = final_answer_text.casefold()
    seen, result = set(), []
    for med in allowed_medicines:                      # đã qua pre_filter_medicines (is_allowed + PHI)
        pid, name = med.get("id"), (med.get("name") or "").strip()
        if pid is None or not name or pid in seen:
            continue
        if med.get("availability") == "NOT_SOLD":
            continue
        if name.casefold() not in answer_lower:        # chỉ thuốc Lavi thực sự nhắc trong câu trả lời
            continue
        seen.add(pid)
        result.append({
            "product_id": pid,
            "product_name": name,
            "active_ingredient": med.get("active_ingredient") or "",
            "image_url": med.get("image_url") or "",
            "phi_days": med.get("phi_days"),
            "rain_resistant": bool(med.get("rain_resistant")),
            "availability": med.get("availability", "IN_STOCK"),
        })
        if len(result) == 3:
            break
    return result
```

- **Không gửi giá** trong `suggested_products`. Giống quy tắc `draft_order`: giá lấy từ Core lúc hiển thị.
- `is_fallback_catalog`: lấy `is_fallback` từ kết quả `query_pesticide_store` (`schema.py`, dòng 161). Danh mục mẫu khi chạy dev **không bao giờ** thành thẻ sản phẩm.
- `guardrail_blocked`: các trường hợp `guardrail_triggered` chặn câu trả lời và chế độ offline (`_offline_events`) đều trả `[]`.
- Đặt hàm ở module riêng (ví dụ `app/agent/product_cards.py`) để viết unit test.
- Thêm `"suggested_products": ...` vào `final_answer` và `AgentResponse.to_dict()`.

### 7.3. Frontend: `features/chat/ProductSuggestionCards.tsx` (thay khối `draft_order` ở dòng 528–566)

- Khi có `suggested_products`: hiện tối đa 3 thẻ ngang, cuộn ngang trên màn hình hẹp. Mỗi thẻ có:
  - ảnh (không có ảnh thì icon `Package`), tên, hoạt chất;
  - nhãn "Cách ly {phi_days} ngày" (null thì "Chưa rõ thời gian cách ly");
  - nhãn "Chống mưa" nếu có;
  - nhãn "Hết hàng" nếu `OUT_OF_STOCK`;
  - **giá lấy từ Core**, không lấy từ agent.
- Giá:
  - Gọi `GET /medicines/search?allowedOnly=true` một lần cho cả tin nhắn và tra theo `product_id` (hoặc `GET /medicines/{id}`).
  - Lỗi thì ẩn giá, vẫn hiện thẻ.
  - Định dạng bằng `formatCurrency` (`src/lib/format.ts`).
- **Bấm vào thẻ**: mở `/store/{product_id}`.
  - Lịch sử chat đã lưu `localStorage` nên đi cùng tab vẫn quay lại được (`useNavigate`).
  - Hiển thị tooltip hoặc icon mũi tên nhỏ `ExternalLink` để người dùng biết bấm vào sẽ sang trang Cửa hàng.
- Xóa `handleAddToCart` cũ cùng khối `draft_order` cũ trong `ChatMessageItem.tsx`. Kiểu `DraftOrder` giữ trong `types.ts` (hợp đồng vẫn có trường), nhưng không render.

---

## 8. PHẦN D: SỬA REDIRECT `/products/:id`

```tsx
function LegacyProductRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/store/${encodeURIComponent(id)}` : '/store'} replace />;
}
// <Route path="/products/:id" element={<LegacyProductRedirect />} />
```

---

## 9. PHỐI HỢP VỚI TASK-24 VÀ TASK-21

- TASK-24 Phần 2 đang sửa `app/agent/prompts.py`; Phần 1 đã sửa `ChatMessageItem.tsx` (nút đọc TTS).
  - Trước khi sửa, `git pull` / `git status`.
  - **Chỉ thêm hoặc sửa đúng các rule nêu ở mục 5.2 và 6.3**, không viết lại cả prompt.
  - Không động vào phần TTS.
- Có người đang làm TASK-21 (router đã có `/admin/inventory/products/:id`). Commit **chỉ các file của task này**. Không gộp file đang sửa dở của người khác (xem `git status` trước khi `git add`; không dùng `git add -A`).

---

## 10. HỢP ĐỒNG API: cập nhật `docs/architecture/api-contracts.md` mục 4.1

- Request: thêm `image_context` (đủ trường và giới hạn như mục 5.1), ghi rõ "Client chỉ gửi khi `/diagnose` trả `is_ood = false`".
- Sự kiện `final_answer`, thêm:

```json
"reference_images": [
  { "image_url": "https://...", "caption": "Vết bệnh dạng giọt dầu mặt dưới lá", "plant_part": "LEAF",
    "credit": "Khuyến nông VN", "license_note": "CC BY 4.0", "source_url": "https://..." }
],
"suggested_products": [
  { "product_id": 3, "product_name": "…", "active_ingredient": "…", "image_url": "", "phi_days": 7,
    "rain_resistant": false, "availability": "IN_STOCK" }
]
```

- Ghi quy tắc:
  - `reference_images` do backend gom từ `lookup_disease_knowledge`, chỉ ảnh đã duyệt, tối đa 3, không để mô hình viết URL.
  - `suggested_products` là thẻ xem; chỉ thuốc đã qua guardrail **và** được nhắc trong `answer`; rỗng khi dùng danh mục mẫu, khi ảnh không chắc chắn, khi offline hoặc guardrail chặn; không có giá.
  - **`draft_order` vẫn `null`** theo BUG-106.
- Client Android (TASK-10) phải bỏ qua được trường lạ. Kiểm tra bộ parse JSON của app Android có cấu hình bỏ qua trường không biết (ví dụ `ignoreUnknownKeys`). Không có thì ghi vào log task cho người làm Android, **không** sửa Android trong task này.

---

## 11. CÁCH KIỂM THỬ TRÊN MÁY

> ⚠️ **Không chạy Core bằng `dotnet run` trong thư mục repo khi test local.** DotNetEnv tự đọc `.env` gốc và nối thẳng vào **Supabase dùng chung**. Chạy Core bằng docker-compose với DB local, hoặc ghi đè `ConnectionStrings__DefaultConnection` trỏ vào Postgres local **trước khi** chạy, rồi kiểm tra log khởi động in host `localhost` chứ không phải `supabase.com`. Không ghi dữ liệu test vào Supabase hay production.

1. Chạy đủ: Postgres local, MinIO local, ai-service (8000), Core (5176 khi chạy ngoài docker; xem `vite.config.ts`), agent-service (8001), web (`npm run dev`, 3000).
   - Agent dùng key Gemini thật được phép cho kiểm thử.
   - **Không** dùng key OpenWeather (chưa được cấp phép). Hỏi các câu không cần thời tiết, hoặc chấp nhận tool thời tiết lỗi.
2. DB local có ít nhất:
   - 2 ảnh mẫu đã duyệt cho `Tomato___Late_blight`: 1 ảnh link https, 1 ảnh tải lên MinIO;
   - 1 thuốc `is_allowed = true` gắn `DiseaseProducts` với bệnh đó.
3. Ca kiểm thử, mỗi ca ghi ảnh chụp màn hình và payload SSE `final_answer` (F12 → Network → `chat` → EventStream):
   - **T1:** ảnh lá cà chua mốc sương rõ → có thẻ nhận diện; câu trả lời nói "theo kết quả nhận diện ảnh…", không nói "mình thấy"; có lưới ảnh mẫu.
   - **T2:** ảnh không phải lá (ví dụ ảnh con mèo) → cảnh báo OOD; Network **không có** request `/api/v1/agent/chat`.
   - **T3:** ảnh mờ ra `is_uncertain = true` → nêu top3, khuyên chụp lại; `suggested_products: []`; câu trả lời không có tên thuốc hóa học. Khó tạo ảnh thật thì dùng Playwright `page.route('**/api/v1/diagnose', ...)` trả JSON giả có `is_uncertain: true`.
   - **T4:** tắt ai-service → `/diagnose` trả 502 → bong bóng báo lỗi, không gọi agent, chữ đã gõ vẫn còn.
   - **T5:** hỏi chữ "Cà chua bị mốc sương xử lý sao?" (không ảnh) → có `reference_images`; nếu Lavi nhắc thuốc thì có thẻ; bấm thẻ mở `/store/{id}`; Back về đúng cuộc chat.
   - **T6:** cờ `VITE_CHAT_ADD_TO_CART` không đặt → không có nút "Thêm vào giỏ". Đặt `true`, khởi động lại Vite → có nút; thêm giỏ xong `/store` thấy đúng sản phẩm, số lượng 1.
   - **T7:** mở DevTools → Application → Local Storage: không còn chuỗi `data:image` trong lịch sử chat. Nạp sẵn một phiên cũ có `data:image` (dán tay) rồi tải lại trang → chuỗi đó bị xóa.
   - **T8:** vào `/products/1` → chuyển tới `/store/1`.
   - **T9:** `harvest_days_left = 2` và thuốc có `phi_days = 7` → thuốc đó không có trong `suggested_products`.
4. Unit test agent (pytest):
   - `build_suggested_products`: thuốc không được nhắc thì không có thẻ; trùng id chỉ một thẻ; `is_fallback` / `image_uncertain` / `guardrail_blocked` cho `[]`; tối đa 3.
   - Validate `ImageContext`: nhận đủ 38 mã của `docs/spec/classes.md`; từ chối `confidence > 1`, `top3` 4 phần tử, `class_code` có khoảng trắng hoặc `<script>`.
   - Gom `reference_images`: chỉ ảnh của bệnh chính, khử trùng, bỏ URL `http://` / `data:`.
5. `npm run build` (frontend) và `pytest` (agent) chạy hết, không có lỗi mới.

---

## 12. TIÊU CHÍ NGHIỆM THU (mỗi dòng cần bằng chứng chạy thật: ảnh chụp, log, payload hoặc output lệnh)

1. Gửi ảnh trong chat không bao giờ gọi `/api/v1/agent/chat` trước khi `/diagnose` trả kết quả. OOD và lỗi thì không gọi agent (T2, T4).
2. Câu trả lời có ảnh luôn nói rõ đây là kết quả nhận diện kèm độ tin cậy, không có câu kiểu "mình thấy trong ảnh" (T1, T3).
3. `is_uncertain = true`: không có thẻ sản phẩm, không có tên thuốc hóa học (T3). Chốt bằng code, có unit test.
4. Ảnh người dùng hiển thị bằng URL MinIO sau khi phân tích. `localStorage` không còn `data:image`, kể cả dữ liệu cũ (T7).
5. `final_answer` có `reference_images` (≤ 3, chỉ ảnh đã duyệt của bệnh chính) và gallery hiện đủ caption, credit, giấy phép, link nguồn (T1, T5).
6. Rule 10 đã thay. Markdown ảnh có URL ngoài `reference_images` không được vẽ thành `<img>`.
7. `final_answer` có `suggested_products` đúng quy tắc mục 7.2; `draft_order` vẫn `null` (T5, T9, unit test).
8. Thẻ sản phẩm hiện giá **lấy từ Core**; bấm thẻ mở `/store/{id}`; Back về đúng cuộc chat (T5).
9. Không có nút "Thêm vào giỏ" khi chưa bật cờ. Bật cờ thì thêm giỏ đúng và giỏ cũ vẫn đọc được (T6).
10. `StorePage`, `ProductDetailPage` và chat dùng chung `cartStorage.ts`. Thêm giỏ ở trang Cửa hàng vẫn chạy như cũ (thử tay 1 lần, có ảnh).
11. `/products/1` chuyển tới `/store/1` (T8).
12. `api-contracts.md` mục 4.1 đã cập nhật đủ `image_context`, `reference_images`, `suggested_products`; quy tắc `draft_order` giữ nguyên.
13. Đã kiểm tra ảnh MinIO `/lavitree-images/` trên production theo mục 6.5 và ghi kết quả. Không tải được thì đã báo trưởng nhóm.
14. Unit test mục 11.4 có và chạy qua; `npm run build` không có lỗi.

---

## 13. NGOÀI PHẠM VI

- Gửi ảnh thẳng cho Gemini hay mô hình đa phương thức.
- Bật "Thêm vào giỏ" trên production (chờ BUG-51).
- Lưu lịch sử chat lên server.
- Sửa nginx cho bucket `lavitree-images` (tách lỗi riêng nếu mục 6.5 cho thấy hỏng).
- Thẻ sản phẩm và ảnh mẫu trên app Android.
- `ProductUsageRules` (TASK-22).

---

## 14. NHẬT KÝ THỰC HIỆN

| Thời gian | Người làm | Việc | Bằng chứng |
|---|---|---|---|
| 23/11/2026 | Claude Code | Tạo task sau khi đọc code chat, agent, `/diagnose`, ảnh tri thức | file này |
| 24/11/2026 | Dunsensei | Làm task trong commit `9b7050b` (gộp chung với TASK-22 và phần khác) | commit `9b7050b` |
| 24/11/2026 | Claude Code | Review commit `9b7050b` và sửa các chỗ lệch task (chưa commit). Agent: chặn cứng `query_pesticide_store` khi ảnh không chắc chắn; `reference_images` chỉ lấy ảnh của bệnh chính; lọc URL ảnh (chỉ https, đường dẫn tương đối, http://localhost khi dev) và `source_url`; thêm test 38 mã lớp, lọc URL, thẻ sản phẩm. Web: không dùng ảnh heatmap hay `blob:` đã thu hồi làm ảnh người dùng; lỗi `/diagnose` giữ lại ảnh và chữ, báo lỗi theo mã 400/422/429/401/502; câu mặc định trung tính; OOD dùng `warning` của Core; xử lý `localStorage` đầy; link `/history/:id`; thẻ sản phẩm dùng được bằng bàn phím | `pytest test_task25_rich_cards.py`: 14 passed; 5 lỗi `test_mcp_tools.py` có sẵn từ trước (cần Core thật); `npm run build` qua; `npm test` 7/7. **Chưa chạy** 9 ca kiểm thử trên máy (T1–T9) và chưa kiểm tra ảnh `/lavitree-images/` trên production |
