FROM python:3.11-slim

WORKDIR /app

# Cài đặt curl phục vụ container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài torch bản CPU trước: bản mặc định kéo theo gói CUDA vài GB mà server không dùng
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# Tạo user thường trước để thư mục cache model thuộc về user này ngay khi tải,
# tránh phải chown -R sau đó (chown ở layer riêng sẽ chép lại toàn bộ ~2GB model)
RUN useradd --system --uid 10001 --no-create-home lavitree \
    && mkdir -p /app/app/data /opt/hf-cache \
    && chown lavitree:lavitree /app/app/data /opt/hf-cache

# Tải trước mô hình embedding vào image khi docker build.
# Chỉ tải file, không nạp model vào RAM (nạp bge-m3 cần ~2.5GB RAM, từng làm treo EC2 1GB).
# Bỏ onnx/ (~2.2GB), ảnh minh hoạ và các head ColBERT/sparse mà SentenceTransformer không dùng.
ENV HF_HOME=/opt/hf-cache
ENV EMBEDDING_MODEL_NAME=BAAI/bge-m3
USER lavitree
RUN python -c "from huggingface_hub import snapshot_download; \
snapshot_download('BAAI/bge-m3', ignore_patterns=['onnx/*', 'imgs/*', '*.jpg', '*.webp', 'colbert_linear.pt', 'sparse_linear.pt'])"
USER root

# Khi container chạy ở runtime, kích hoạt chế độ offline triệt để (không gọi mạng ngoài)
ENV TRANSFORMERS_OFFLINE=1
ENV HF_HUB_OFFLINE=1

COPY . .

# Chạy bằng user thường; app/data là nơi duy nhất cần ghi (volume agent_data thừa hưởng quyền này)
USER lavitree

EXPOSE 8001

# Nạp model bge-m3 mất khoảng 20 giây trên CPU nên start-period phải đủ dài
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
