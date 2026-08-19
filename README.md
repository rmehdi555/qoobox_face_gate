# FaceGate

FaceGate is a production-ready face recognition web application. Administrators register people with names and face images. A live camera page captures webcam frames, sends them to the backend, and displays whether the person is recognized, unknown, or no face is visible.

The user interface is in English.

## Features

- Secure admin login with JWT
- People dashboard with search, create, edit, and delete
- Multiple face images per person
- Face validation on upload (exactly one detectable face)
- Live webcam recognition with automatic status updates
- InsightFace embeddings compared with a configurable similarity threshold
- PostgreSQL storage, Alembic migrations, Docker Compose deployment
- Structured logging, health checks, and Swagger documentation

## Architecture

```text
Browser (React + TypeScript + Vite)
        |
        |  /api  (proxied by Nginx in Docker)
        v
FastAPI backend
        |-- JWT auth
        |-- Person and face image CRUD
        |-- InsightFace detection + embedding (CPU / ONNX Runtime)
        |-- In-memory cosine-similarity index
        |
        +-- PostgreSQL
        +-- File volume  /app/storage/faces
        +-- Model volume /app/storage/models
```

Recognition flow:

1. Detect a face in the image
2. Generate a 512-d embedding with InsightFace
3. Compare it with stored embeddings using cosine similarity
4. If the best score is at or above `FACE_RECOGNITION_THRESHOLD`, return that person
5. Otherwise return unknown (or no face, if none was detected)

The in-memory index is designed so it can later be replaced with a vector database without changing the API.

## Requirements

- Docker and Docker Compose
- A webcam for Live Recognition
- Outbound network on first backend start (InsightFace downloads the model once)

**No NVIDIA GPU, CUDA toolkit, or NVIDIA Container Toolkit is required.** Face recognition runs on CPU with `onnxruntime` and `CPUExecutionProvider`.

You do not need to install Python, Node.js, or PostgreSQL on the host.

## Quick start

```bash
docker compose up --build
```

On first start the backend downloads the InsightFace `buffalo_s` model. That can take a few minutes. Later starts reuse the `insightface_models` volume.

### URLs

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Health | http://localhost:8000/health |
| Swagger | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

### Create the first admin

There is no default password. Create an administrator after the stack is healthy:

```bash
docker compose exec backend python -m app.scripts.create_admin
```

You will be asked for email and password. Non-interactive example:

```bash
docker compose exec backend python -m app.scripts.create_admin --email admin@example.com --password 'choose-a-strong-password'
```

Then open http://localhost:3000, sign in, add a person, upload face images, and open **Live Recognition**.

## Environment variables

Copy `.env.example` to `.env` and change secrets before any real deployment.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://facegate:facegate@postgres:5432/facegate` | SQLAlchemy database URL |
| `JWT_SECRET_KEY` | `change-me-to-a-long-random-secret` | JWT signing secret |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token lifetime |
| `FACE_RECOGNITION_THRESHOLD` | `0.5` | Minimum cosine similarity to accept a match |
| `FACE_RECOGNITION_MODEL` | `buffalo_s` | InsightFace pack (`buffalo_s` or `buffalo_l`) |
| `RECOGNITION_INTERVAL_MS` | `500` | Frontend capture interval |
| `MAX_UPLOAD_SIZE_MB` | `10` | Maximum face image size |
| `STORAGE_PATH` | `/app/storage/faces` | Uploaded image directory |
| `INSIGHTFACE_HOME` | `/app/storage/models` | Model cache directory |
| `CORS_ORIGINS` | localhost frontend origins | Allowed browser origins |
| `LOG_LEVEL` | `INFO` | Application log level |

Change the recognition threshold without code changes:

```bash
# .env
FACE_RECOGNITION_THRESHOLD=0.45
```

Then recreate the backend:

```bash
docker compose up -d backend
```

Lower values match more loosely. Higher values require a closer match.

## How to add a person

1. Sign in at http://localhost:3000
2. Open **People** → **Add Person**
3. Enter **First Name** and **Last Name**
4. Upload one or more face images (JPG, JPEG, PNG, or WEBP)
5. Click **Save Person**

Each image must contain exactly one detectable face. Images with no face or multiple faces are rejected.

## How to use Live Recognition

1. Register at least one person with a clear face image
2. Open **Live Recognition**
3. Allow camera access when the browser asks
4. Look at the camera

Status cards:

- **Person Recognized** — name and confidence
- **Unknown Person** — a face was found but no registered match
- **No Face Detected** — look at the camera
- **Camera Unavailable** — permission denied or no camera

The frontend captures JPEG frames about every `RECOGNITION_INTERVAL_MS` milliseconds and does not send a new request until the previous one finishes.

## How face recognition works

InsightFace is loaded once when the backend starts, not on every request. Registered embeddings are kept in memory. Creating, updating, or deleting people and face images refreshes that index.

Uploaded binaries are stored on disk (`STORAGE_PATH`). PostgreSQL stores metadata and embedding vectors as JSON, not image bytes.

## Database migrations

Migrations run automatically when the backend container starts.

Manual commands:

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic downgrade -1
docker compose exec backend alembic history
```

## Tests

```bash
docker compose exec backend pytest
```

Face detection is mocked in unit tests so CI does not need the InsightFace model files. The running application uses real CPU InsightFace inference (`onnxruntime`, not `onnxruntime-gpu`).

## Docker commands

```bash
docker compose up --build
docker compose up --build -d
docker compose down
docker compose logs -f backend
docker compose exec backend bash
```

Persistent volumes:

- `postgres_data` — database
- `face_storage` — uploaded faces
- `insightface_models` — downloaded InsightFace models

## Camera access and HTTPS

Browsers treat `http://localhost` and `http://127.0.0.1` as secure contexts, so webcam access works for local Docker on the same machine.

If you open FaceGate by LAN IP (`http://192.168.x.x:3000`) or in production over plain HTTP, `getUserMedia` is usually blocked.

For production, put the stack behind HTTPS with a reverse proxy such as Nginx or Caddy. Terminate TLS on the proxy and forward to the frontend (port 3000 / Nginx in this compose file) and optionally to the backend.

Example Nginx TLS terminator in front of FaceGate:

```nginx
server {
    listen 443 ssl;
    server_name facegate.example.com;

    ssl_certificate     /etc/ssl/certs/facegate.crt;
    ssl_certificate_key /etc/ssl/private/facegate.key;

    client_max_body_size 15m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Also set `CORS_ORIGINS` to your public HTTPS origin.

## Production considerations

- Replace `JWT_SECRET_KEY` and database passwords with strong unique values
- Do not commit `.env`
- Serve the application over HTTPS
- Restrict CORS to your real frontend origin
- Back up PostgreSQL and the `face_storage` volume
- Consider `buffalo_l` for higher accuracy if you have more CPU
- For large galleries, replace the in-memory index with a vector database
- Add rate limiting on `/api/auth/login` and `/api/recognition/recognize` at the proxy
- Run database backups (`pg_dump`) on a schedule

## CPU-only execution

FaceGate is designed for machines without an NVIDIA GPU.

- Backend uses the CPU wheel `onnxruntime`, never `onnxruntime-gpu`
- InsightFace is loaded with `CPUExecutionProvider` and `ctx_id=-1`
- Containers set `CUDA_VISIBLE_DEVICES=-1` and `NVIDIA_VISIBLE_DEVICES=void`
- Compose does not request GPUs or the NVIDIA runtime

No NVIDIA driver, CUDA toolkit, or NVIDIA Container Toolkit is needed.

## Troubleshooting

**Docker Hub or `public.ecr.aws` DNS/timeout errors**  
Those registries are often unreachable on Iranian networks. FaceGate defaults to ArvanCloud images, Aliyun PyPI, and the npmmirror npm registry.

Retry:

```bash
docker compose up --build
```

If ArvanCloud is also blocked, try Hamdocker in `.env`:

```env
POSTGRES_IMAGE=hub.hamdocker.ir/library/postgres:16-alpine
PYTHON_IMAGE=hub.hamdocker.ir/library/python:3.12-slim-bookworm
NODE_IMAGE=hub.hamdocker.ir/library/node:22-alpine
NGINX_IMAGE=hub.hamdocker.ir/library/nginx:1.27-alpine
```

Optional Docker Engine mirror (Docker Desktop → Settings → Docker Engine):

```json
{
  "registry-mirrors": ["https://docker.arvancloud.ir"]
}
```

**HTTP 402 Payment Required (Runflare)**  
Runflare mirrors require credit. pip now uses Aliyun + PyPI, and npm uses `https://registry.npmmirror.com` (then registry.npmjs.org).

Retry:

```bash
docker compose up --build
```

**Backend is unhealthy / model download is slow**  
The API starts before the model finishes loading. Dashboard status shows **Unavailable** until InsightFace is ready. Check `docker compose logs -f backend`.

**Login fails immediately after start**  
Create an admin first. There is no seeded user.

**Upload says “exactly one face”**  
Use a well-lit photo of a single person, facing the camera, without a group shot.

**Live Recognition never matches**  
Add more images of the same person, improve lighting, or lower `FACE_RECOGNITION_THRESHOLD` slightly.

**Camera Unavailable**  
Allow camera permission, use localhost (not a raw LAN IP over HTTP), and confirm another app is not locking the webcam.

**Frontend cannot reach the API**  
In Docker the UI proxies `/api` to `backend:8000`. Confirm the backend container is up: `docker compose ps`.

## Project layout

```text
.
├── backend/                 FastAPI application
│   ├── app/
│   │   ├── api/             HTTP routes
│   │   ├── core/            settings, security, logging
│   │   ├── database/        engine and sessions
│   │   ├── models/          SQLAlchemy models
│   │   ├── recognition/     InsightFace engine and index
│   │   ├── repositories/    data access
│   │   ├── schemas/         Pydantic schemas
│   │   ├── services/        business logic
│   │   ├── scripts/         create_admin CLI
│   │   └── main.py
│   ├── alembic/             migrations
│   ├── tests/
│   └── Dockerfile
├── frontend/                React + TypeScript + Vite + Tailwind
├── storage/                 local placeholder for uploads
├── docker-compose.yml
├── .env.example
├── Makefile
└── README.md
```

## License

Use and modify this project for your own deployments. Review InsightFace and model license terms before commercial use.
