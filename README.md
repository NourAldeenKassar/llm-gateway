# LLM Gateway

Self-hosted API gateway that routes requests to multiple LLM providers with automatic fallback. Manage providers, API keys, and fallback priorities from a built-in dashboard.

## Features

- **Single endpoint** -- apps send a prompt, the gateway picks the best available provider
- **Automatic fallback** -- if a provider fails or rate-limits, the next one in the chain is tried
- **Free vs paid control** -- `freeOnly` param ensures apps never hit paid providers unless explicitly allowed
- **Admin dashboard** -- add/remove providers, configure priorities, inline editing, provider health checks
- **Chat playground** -- test providers directly from the dashboard with conversation history
- **Model browser** -- lists available models from each provider's API
- **Health checks** -- manually trigger health checks across all providers with latency tracking
- **Multiple accounts** -- add the same provider multiple times with different API keys
- **API key auth** -- gateway endpoint protected by a single API key

## Tested Providers

| Provider | Type | Free Tier |
|---|---|---|
| Groq | OpenAI-compatible | Yes |
| Google Gemini | Google AI SDK | Yes |
| Mistral | OpenAI-compatible | Yes |
| OpenAI | OpenAI-compatible | No (paid) |

## Tech Stack

- **Backend:** NestJS, Prisma, PostgreSQL
- **Frontend:** React, Vite, Tailwind CSS
- **Deployment:** Docker, GitHub Actions, GHCR

## API

### POST `/api/generate`

**Headers:**
```
Authorization: Bearer <GATEWAY_API_KEY>
```

**Body:**
```json
{
  "prompt": "What is 2+2?",
  "system": "Be concise.",
  "freeOnly": true,
  "temperature": 0.7,
  "maxTokens": 500
}
```

Only `prompt` is required. Set `freeOnly: true` to restrict to free-tier providers, `false` to allow paid.

**Response:**
```json
{
  "text": "4",
  "provider": "groq",
  "model": "openai/gpt-oss-120b"
}
```

### GET `/api/health`

No auth required. Returns system status and provider health (cached from last manual check).

## Local Development

```bash
# start postgres
docker compose up -d db

# install dependencies
npm install
cd frontend && npm install && cd ..

# run migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/llm_gateway?schema=public" npx prisma migrate dev

# start backend (watch mode)
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/llm_gateway?schema=public" \
GATEWAY_API_KEY=test-key \
ADMIN_PASSWORD=admin \
npm run start:dev

# start frontend (separate terminal)
cd frontend && npm run dev
```

Backend runs on `http://localhost:3000`, frontend on `http://localhost:5173`.

## Docker

```bash
docker compose up
```

## Production (Docker image)

```yaml
services:
  llm-gateway:
    image: ghcr.io/nouraldeenkassar/llm-gateway:latest
    ports:
      - "3005:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@host:5432/llm_gateway?schema=public
      GATEWAY_API_KEY: your-secret-key
      ADMIN_PASSWORD: your-admin-password
    restart: unless-stopped
```

The container runs migrations on startup and serves both the API and dashboard.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GATEWAY_API_KEY` | Yes | API key for the `/api/generate` endpoint |
| `ADMIN_PASSWORD` | Yes | Password for the admin dashboard |
| `PORT` | No | Server port (default: 3000) |

Provider API keys (Groq, Gemini, etc.) are managed through the dashboard, not env vars.
