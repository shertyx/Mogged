FROM python:3.11-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake libopenblas-dev liblapack-dev \
    && rm -rf /var/lib/apt/lists/*
COPY services/face-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=builder /usr/local/bin /usr/local/bin
COPY services/face-service/ .
COPY ai/extract_features.py ./ai/extract_features.py
COPY ai/models/ ./ai/models/
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
