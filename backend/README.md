# Fluvius Backend

Backend for the Fluvius customer support SaaS.
Built with FastAPI, SQLAlchemy 2.x, Alembic, and Pydantic.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Sync dependencies:
   ```bash
   uv sync
   ```

3. Run migrations:
   ```bash
   uv run alembic upgrade head
   ```

4. Seed the database (creates a mock workspace, inbox, connection, contact, and conversation):
   ```bash
   uv run python -m app.seed
   ```

5. Run development server:
   ```bash
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Local Network URLs

The backend must listen on `0.0.0.0:8000` so both the browser and Docker containers can reach it during local development.

- Browser/frontend -> backend: `http://localhost:8000` and `ws://localhost:8000/ws`
- Evolution API container -> backend webhook: `http://host.docker.internal:8000/webhooks/evolution/{connection_id}`
- Linux fallback for the webhook, only if needed: `http://172.17.0.1:8000/webhooks/evolution/{connection_id}`
- Backend host -> Evolution API: `http://localhost:8080`

Expected local `.env` values:

```env
FRONTEND_ORIGIN=http://localhost:5173
PUBLIC_API_BASE_URL=http://localhost:8000
WEBHOOK_PUBLIC_BASE_URL=http://host.docker.internal:8000
EVOLUTION_BASE_URL=http://localhost:8080
EVOLUTION_API_KEY=...
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```
