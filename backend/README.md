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
   uv run fastapi dev app/main.py
   ```
