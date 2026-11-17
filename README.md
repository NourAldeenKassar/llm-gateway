# LLM Gateway

Self-hosted API gateway that routes requests to multiple LLM providers with automatic fallback. Manage providers, API keys, and fallback priorities from a built-in dashboard.

## Features

- **Single endpoint** -- apps send a prompt, the gateway picks the best available provider
- **Automatic fallback** -- if a provider fails or rate-limits, the next one in the chain is tried
- **Tiered API keys** -- each key is free, paid or any; the gateway enforces it, so an app cannot choose its own tier
- **Per-app API keys** -- create API keys for each app with a tier and optional expiry, track usage per app
- **Admin dashboard** -- add/remove providers, configure priorities, inline editing, provider health checks
- **Chat playground** -- test providers directly from the dashboard with conversation history and markdown rendering
- **Monitoring** -- per-provider usage stats, request logs with in/out tokens, latency tracking, rate limit detection
- **Model browser** -- lists available models from each provider's API
- **Health checks** -- manually trigger health checks across all providers with latency tracking
- **Multiple accounts** -- add the same provider multiple times with different API keys
- **API documentation** -- built-in docs page with endpoint reference and curl examples

## Tested Providers

| Provider | Type | Free Tier |
|---|---|---|
| Groq | OpenAI-compatible | Yes |
| Google Gemini | Google AI SDK | Yes |
| Mistral | OpenAI-compatible | Yes |
| OpenAI | OpenAI-compatible | No (paid) |
| Grok (xAI) | OpenAI-compatible | No (paid) |

## Tech Stack

- **Backend:** NestJS, Prisma, PostgreSQL
- **Frontend:** React, Vite, Tailwind CSS
- **Testing:** Jest, 49 unit tests
- **Deployment:** Docker, GitHub Actions, GHCR

## API

### POST `/api/generate`

**Headers:**
```
Authorization: Bearer <API_KEY>
```

**Body:**
```json
{
  "prompt": "What is 2+2?",
  "system": "Be concise.",
  "temperature": 0.7,
  "maxTokens": 500
}
```

Only `prompt` is required. The request cannot choose between free and paid providers -- that is decided by the tier of the API key (see [Key Tiers](#key-tiers)).

**Response:**
```json
{
  "text": "4",
  "provider": "groq",
  "model": "openai/gpt-oss-120b"
}
```

When a fallback occurs, the response includes which providers failed:

```json
{
  "text": "4",
  "provider": "gemini",
  "model": "gemini-3.6-flash",
  "failedProviders": [
    { "provider": "groq", "error": "429 Too Many Requests" }
  ]
}
```

**Errors:**

| Status | Meaning |
|---|---|
| 401 | Missing or invalid API key |
| 403 | The pinned provider is not allowed on this key's tier |
| 503 | Every provider on the key's tier failed, or none are configured |

### GET `/api/health`

No auth required. Returns system status and provider health (cached from last manual check).

## Key Tiers

Every API key has a tier, set when the key is created and changeable from the dashboard. The gateway decides which providers a request may reach based on that tier alone, so an app cannot grant itself paid access.

| Tier | Providers it can reach |
|---|---|
| `free` | Free providers only |
| `paid` | Paid providers only |
| `any` | Both, in priority order |

Routing is **strict**: a `paid` key never falls back to a free provider, and a `free` key never reaches a paid one. If every provider on the key's tier fails, the request returns 503 rather than silently downgrading.

To give one app both, issue it two keys:

```
stock-app-free     tier: free    used for summaries
stock-app-premium  tier: paid    used for the premium feature
```

Because `RequestLog` records the key name per request, each one shows up separately in the dashboard stats.

Keys created before this feature existed default to `free`. Upgrade them in Settings.

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

# run tests
npm test
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
      GATEWAY_API_KEY: your-fallback-key
      ADMIN_PASSWORD: your-admin-password
    restart: unless-stopped
```

The container runs migrations on startup and serves both the API and dashboard.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GATEWAY_API_KEY` | No | Fallback API key (prefer creating keys via dashboard) |
| `ADMIN_PASSWORD` | Yes | Initial password for the admin dashboard (can be changed via settings) |
| `PORT` | No | Server port (default: 3000) |

Provider API keys and gateway API keys are managed through the dashboard, not env vars. `GATEWAY_API_KEY` is a fallback for backward compatibility.
