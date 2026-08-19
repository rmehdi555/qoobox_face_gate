ARG PYTHON_IMAGE=docker.arvancloud.ir/library/python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    CUDA_VISIBLE_DEVICES=-1 \
    NVIDIA_VISIBLE_DEVICES=void \
    ONNX_EXECUTION_PROVIDERS=CPUExecutionProvider \
    OMP_NUM_THREADS=4

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
        libsm6 \
        libxext6 \
        libxrender1 \
        curl \
        ffmpeg \
        gcc \
        g++ \
        make \
        python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple
ARG PIP_EXTRA_INDEX_URL=https://pypi.org/simple
ARG PIP_TRUSTED_HOST=mirrors.aliyun.com
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefer-binary --retries 10 --timeout 120 \
        --index-url "${PIP_INDEX_URL}" \
        --extra-index-url "${PIP_EXTRA_INDEX_URL}" \
        --trusted-host "${PIP_TRUSTED_HOST}" \
        --trusted-host pypi.org \
        --trusted-host files.pythonhosted.org \
        --trusted-host pypi.python.org \
        --trusted-host mirror-pypi.runflare.com \
        -r requirements.txt

COPY . .

RUN sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh \
    && mkdir -p /app/storage/faces /app/storage/models /app/storage/whisper

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
