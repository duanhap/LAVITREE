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

# Tải trước mô hình embedding đa ngôn ngữ vào image cache khi docker build
ENV HF_HOME=/opt/hf-cache
ENV EMBEDDING_MODEL_NAME=BAAI/bge-m3
ENV TRANSFORMERS_OFFLINE=0
ENV HF_HUB_OFFLINE=0
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"

# Khi container chạy ở runtime, kích hoạt chế độ offline triệt để (không gọi mạng ngoài)
ENV TRANSFORMERS_OFFLINE=1
ENV HF_HUB_OFFLINE=1

COPY . .

# Chạy bằng user thường; app/data là nơi duy nhất cần ghi (volume agent_data thừa hưởng quyền này)
RUN useradd --system --uid 10001 --no-create-home lavitree \
    && mkdir -p /app/app/data \
    && chown -R lavitree:lavitree /app/app/data /opt/hf-cache
USER lavitree

EXPOSE 8001

# Nạp model bge-m3 mất khoảng 20 giây trên CPU nên start-period phải đủ dài
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
