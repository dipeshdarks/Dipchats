# DipChats

Real-time mesh-enabled chat platform built with React, Fastify, PostgreSQL, Redis, and WebSockets.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React + Vite                      │
│  Zustand · Tailwind · WebSocket Client               │
└───────────┬──────────────────────────┬──────────────┘
            │ REST + WS                │
┌───────────▼──────────────────────────▼──────────────┐
│                   Fastify Server                     │
│  REST API · WebSocket Gateway · MinIO                │
└──────┬────────────┬──────────────┬──────────────────┘
       │            │              │
┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
│ PostgreSQL  │ │ Redis  │ │   MinIO     │
│ Drizzle ORM │ │ PubSub │ │ Object Store│
└─────────────┘ └────────┘ └─────────────┘
```

## Features

- **Real-time messaging** — WebSocket-based with ACK, persistence, and sync on reconnect
- **Channel discovery** — Browse, search, and join public channels
- **People discovery** — Find other users and start DMs
- **Privacy controls** — Block users, manage friendships, control discoverability
- **Session-based auth** — No passwords, no registration. Just pick a name.
- **Mesh networking** — Designed for multi-device, multi-network communication
- **Fallback mode** — Runs without PostgreSQL (in-memory repositories)

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (optional, for PostgreSQL + Redis + MinIO)

### Development

```bash
# Install dependencies
pnpm install

# Start with Docker (PostgreSQL + Redis + MinIO)
docker-compose up -d

# Start the server
cd apps/server
pnpm dev

# Start the web app (separate terminal)
cd apps/web
pnpm dev
```

### Without Docker

The server runs with in-memory fallback when PostgreSQL is unavailable. Redis is optional.

```bash
pnpm install
cd apps/server && pnpm dev
cd apps/web && pnpm dev
```

Open `http://localhost:3000`.

## Project Structure

```
dipchats/
├── apps/
│   ├── server/          # Fastify API + WebSocket gateway
│   └── web/             # React + Vite frontend
├── packages/
│   ├── database/        # Drizzle ORM schema + migrations
│   └── shared/          # Shared types and utilities
├── docs/                # Architecture & protocol documentation
├── tests/               # Integration tests
├── docker-compose.yml   # PostgreSQL + Redis + MinIO
└── vitest.config.ts     # Test configuration
```

## API

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/join` | Join with a display name |
| GET | `/api/v1/auth/me` | Get current device profile |
| GET | `/api/v1/channels/discover` | Browse public channels |
| POST | `/api/v1/channels` | Create a channel |
| POST | `/api/v1/channels/:id/join` | Join a channel |
| GET | `/api/v1/people/discover` | Discover users |
| GET | `/api/v1/search` | Global search |

### WebSocket

Connect to `ws://localhost:4000/ws`:

```json
// Auth
{"type":"auth.join","payload":{"token":"<session-token>"}}

// Send message
{"type":"message.send","payload":{"channelId":"chan_general","content":"Hello!"}}

// Subscribe to channel
{"type":"channel.subscribe","payload":{"channelId":"chan_general"}}
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [WebSocket Protocol](docs/WEBSOCKET_PROTOCOL.md)
- [Security](docs/SECURITY.md)
- [Mesh Network](docs/MESH_NETWORK.md)
- [Docker Setup](docs/DOCKER.md)
- [Database Schema](docs/DATABASE.md)

## License

MIT
