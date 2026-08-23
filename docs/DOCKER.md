# Docker Compose Architecture — DipChats

## Table of Contents

1. [Overview](#overview)
2. [Services](#services)
3. [docker-compose.yml](#docker-composeyml)
4. [Dockerfiles](#dockerfiles)
5. [Environment Variables](#environment-variables)
6. [Volumes & Networks](#volumes--networks)
7. [Health Checks](#health-checks)
8. [Development vs Production](#development-vs-production)
9. [Common Operations](#common-operations)
10. [.env.example](#envexample)

---

## Overview

DipChats runs five services orchestrated through Docker Compose:

```
┌─────────────────────────────────────────────────────┐
│                   dipchats network                   │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐    │
│  │   web    │──▶│  server  │──▶│   postgres   │    │
│  │ React    │   │ Fastify  │   │  PostgreSQL   │    │
│  │ :3000    │   │ :4000    │   │   :5432      │    │
│  └──────────┘   │ :4001 WS │   └──────────────┘    │
│                 └────┬─────┘                         │
│                      │                               │
│            ┌─────────┴─────────┐                     │
│            ▼                   ▼                     │
│     ┌──────────┐       ┌──────────┐                 │
│     │  redis   │       │  minio   │                 │
│     │  :6379   │       │ :9000    │                 │
│     └──────────┘       │ :9001    │                 │
│                        └──────────┘                 │
└─────────────────────────────────────────────────────┘
```

The frontend communicates with the server over HTTP and WebSocket. The server
persists data to PostgreSQL, caches in Redis, and stores files in MinIO.

---

## Services

| Service    | Image                     | Ports              | Purpose                         |
|------------|---------------------------|--------------------|---------------------------------|
| web        | node:20-alpine            | 3000               | React SPA, Vite dev server      |
| server     | node:20-alpine            | 4000, 4001         | Fastify API + WebSocket gateway |
| postgres   | postgres:16-alpine        | 5432               | Primary relational database     |
| redis      | redis:7-alpine            | 6379               | Cache, sessions, pub/sub        |
| minio      | minio/minio:latest        | 9000, 9001         | S3-compatible object storage    |

---

## docker-compose.yml

```yaml
# docker-compose.yml
version: "3.9"

services:
  # ── Frontend ──────────────────────────────────────────────────────────
  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    container_name: dipchats-web
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      VITE_API_URL: http://localhost:4000
      VITE_WS_URL: ws://localhost:4001
    volumes:
      - ./web:/app
      - web_node_modules:/app/node_modules
    depends_on:
      server:
        condition: service_healthy
    networks:
      - dipchats
    restart: unless-stopped

  # ── Backend API + WebSocket ───────────────────────────────────────────
  server:
    build:
      context: .
      dockerfile: docker/Dockerfile.server
    container_name: dipchats-server
    ports:
      - "4000:4000"
      - "4001:4001"
    environment:
      NODE_ENV: development
      PORT: 4000
      WS_PORT: 4001
      DATABASE_URL: postgres://dipchats:dipchats_secret@postgres:5432/dipchats
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: dipchats_minio
      MINIO_SECRET_KEY: dipchats_minio_secret
      MINIO_BUCKET: dipchats
      JWT_SECRET: change_me_in_production
      JWT_EXPIRES_IN: 7d
    volumes:
      - ./server:/app
      - server_node_modules:/app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - dipchats
    restart: unless-stopped

  # ── PostgreSQL ────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: dipchats-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: dipchats
      POSTGRES_USER: dipchats
      POSTGRES_PASSWORD: dipchats_secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dipchats -d dipchats"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - dipchats
    restart: unless-stopped

  # ── Redis ─────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: dipchats-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    networks:
      - dipchats
    restart: unless-stopped

  # ── MinIO (S3-compatible) ─────────────────────────────────────────────
  minio:
    image: minio/minio:latest
    container_name: dipchats-minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: dipchats_minio
      MINIO_ROOT_PASSWORD: dipchats_minio_secret
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - dipchats
    restart: unless-stopped

# ── Named Volumes ─────────────────────────────────────────────────────
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  minio_data:
    driver: local
  web_node_modules:
    driver: local
  server_node_modules:
    driver: local

# ── Networks ──────────────────────────────────────────────────────────
networks:
  dipchats:
    driver: bridge
    name: dipchats-network
```

---

## Dockerfiles

### docker/Dockerfile.server

```dockerfile
# docker/Dockerfile.server
FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=development

# ── Dependencies ──────────────────────────────────────────────────────
FROM base AS deps
COPY server/package.json server/package-lock.json* ./
RUN npm ci

# ── Development ───────────────────────────────────────────────────────
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY server .
EXPOSE 4000 4001
CMD ["dumb-init", "node", "--watch", "--loader", "tsx/esm", "src/index.ts"]

# ── Build ─────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY server .
RUN npx tsc

# ── Production ────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server/package.json ./
EXPOSE 4000 4001
CMD ["dumb-init", "node", "dist/index.js"]
```

### docker/Dockerfile.web

```dockerfile
# docker/Dockerfile.web
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=development

# ── Dependencies ──────────────────────────────────────────────────────
FROM base AS deps
COPY web/package.json web/package-lock.json* ./
RUN npm ci

# ── Development ───────────────────────────────────────────────────────
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY web .
EXPOSE 3000
CMD ["npx", "vite", "--host", "0.0.0.0"]

# ── Build ─────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY web .
RUN npx vite build

# ── Production (Nginx) ───────────────────────────────────────────────
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

### docker/nginx.conf

```nginx
server {
    listen 3000;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Environment Variables

### Server

| Variable             | Required | Default                    | Description                              |
|----------------------|----------|----------------------------|------------------------------------------|
| `NODE_ENV`           | Yes      | `development`              | Runtime environment                      |
| `PORT`               | No       | `4000`                     | HTTP API port                            |
| `WS_PORT`            | No       | `4001`                     | WebSocket port                           |
| `DATABASE_URL`       | Yes      | —                          | PostgreSQL connection string             |
| `REDIS_URL`          | Yes      | —                          | Redis connection string                  |
| `MINIO_ENDPOINT`     | Yes      | —                          | MinIO base URL                           |
| `MINIO_ACCESS_KEY`   | Yes      | —                          | MinIO access key                         |
| `MINIO_SECRET_KEY`   | Yes      | —                          | MinIO secret key                         |
| `MINIO_BUCKET`       | No       | `dipchats`                 | Default bucket name                      |
| `JWT_SECRET`         | Yes      | —                          | Token signing secret                     |
| `JWT_EXPIRES_IN`     | No       | `7d`                       | Token expiration                         |
| `LOG_LEVEL`          | No       | `info`                     | Logger verbosity (trace, debug, info…)   |
| `CORS_ORIGIN`        | No       | `http://localhost:3000`    | Allowed CORS origin                      |

### Web

| Variable        | Required | Default                   | Description                    |
|-----------------|----------|---------------------------|--------------------------------|
| `NODE_ENV`      | Yes      | `development`             | Runtime environment            |
| `VITE_API_URL`  | No       | `http://localhost:4000`   | Backend REST endpoint          |
| `VITE_WS_URL`   | No       | `ws://localhost:4001`     | WebSocket endpoint             |

### Postgres

| Variable          | Required | Default          |
|-------------------|----------|------------------|
| `POSTGRES_DB`     | Yes      | `dipchats`       |
| `POSTGRES_USER`   | Yes      | `dipchats`       |
| `POSTGRES_PASSWORD` | Yes    | `dipchats_secret` |

### MinIO

| Variable              | Required | Default                  |
|-----------------------|----------|--------------------------|
| `MINIO_ROOT_USER`     | Yes      | `dipchats_minio`         |
| `MINIO_ROOT_PASSWORD` | Yes      | `dipchats_minio_secret`  |

---

## Volumes & Networks

### Volumes

| Volume                | Purpose                               |
|-----------------------|---------------------------------------|
| `postgres_data`       | Persistent PostgreSQL data            |
| `redis_data`          | Redis append-only file + snapshots    |
| `minio_data`          | Object storage files                  |
| `web_node_modules`    | Prevents host/node_modules conflicts  |
| `server_node_modules` | Prevents host/node_modules conflicts  |

### Network

All services attach to the `dipchats-network` bridge network. This isolates
inter-container traffic and allows services to reference each other by
service name (e.g., `postgres`, `redis`, `minio`).

---

## Health Checks

Every infrastructure service has a health check so dependent services wait
for a healthy state before starting.

| Service    | Command                                | Interval | Timeout | Retries |
|------------|----------------------------------------|----------|---------|---------|
| postgres   | `pg_isready -U dipchats -d dipchats`   | 10s      | 5s      | 5       |
| redis      | `redis-cli ping`                       | 10s      | 5s      | 5       |
| minio      | `mc ready local`                       | 10s      | 5s      | 5       |
| server     | `curl -f http://localhost:4000/health` | 15s      | 5s      | 3       |

The `web` and `server` services use `depends_on` with
`condition: service_healthy` so they only start after their dependencies
are ready.

---

## Development vs Production

### Development (default)

```bash
docker compose up
```

- Bind-mounts source directories for hot-reload
- Node modules stored in named volumes to avoid cross-platform conflicts
- Server runs with `--watch` for auto-restart on file changes
- Vite dev server handles HMR for the frontend

### Production overrides — docker-compose.prod.yml

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
      target: prod
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    volumes: []

  server:
    build:
      context: .
      dockerfile: docker/Dockerfile.server
      target: prod
    ports:
      - "4000:4000"
      - "4001:4001"
    environment:
      NODE_ENV: production
    volumes: []
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G

  redis:
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

  minio:
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
```

Run with:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Common Operations

### Start everything

```bash
docker compose up -d
```

### View logs

```bash
# All services
docker compose logs -f

# Single service
docker compose logs -f server
```

### Stop without removing

```bash
docker compose stop
```

### Stop and remove containers

```bash
docker compose down
```

### Full reset (destroy data)

```bash
docker compose down -v
rm -rf server/node_modules web/node_modules
docker compose up --build
```

### Database migrations

```bash
docker compose exec server npx prisma migrate dev
docker compose exec server npx prisma db seed
```

### Access a service shell

```bash
docker compose exec postgres psql -U dipchats -d dipchats
docker compose exec redis redis-cli
docker compose exec server sh
```

### Backup PostgreSQL

```bash
docker compose exec postgres pg_dump -U dipchats dipchats > backup_$(date +%Y%m%d).sql
```

### Restore PostgreSQL

```bash
cat backup_20260823.sql | docker compose exec -T postgres psql -U dipchats -d dipchats
```

### Rebuild a single service

```bash
docker compose build server --no-cache
docker compose up -d server
```

### Check service health

```bash
docker compose ps
```

---

## .env.example

```bash
# ── Server ─────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=4000
WS_PORT=4001
DATABASE_URL=postgres://dipchats:dipchats_secret@postgres:5432/dipchats
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=dipchats_minio
MINIO_SECRET_KEY=dipchats_minio_secret
MINIO_BUCKET=dipchats
JWT_SECRET=replace_with_a_strong_random_string
JWT_EXPIRES_IN=7d
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000

# ── Web ────────────────────────────────────────────────────────────────
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4001

# ── Postgres ───────────────────────────────────────────────────────────
POSTGRES_DB=dipchats
POSTGRES_USER=dipchats
POSTGRES_PASSWORD=dipchats_secret

# ── Redis ──────────────────────────────────────────────────────────────
# Only needed in production when requirepass is set
# REDIS_PASSWORD=

# ── MinIO ──────────────────────────────────────────────────────────────
MINIO_ROOT_USER=dipchats_minio
MINIO_ROOT_PASSWORD=dipchats_minio_secret
```

Copy this file to `.env` in the project root and adjust values for your
environment. Never commit the real `.env` file.

```bash
cp .env.example .env
```
