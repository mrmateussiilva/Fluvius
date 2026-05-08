# Fluvius

Fluvius é um customer support/chat inbox SaaS inspirado no WhatsApp Web e Chatwoot, com arquitetura provider-agnostic. Atualmente configurado com Evolution API como gateway de mensagens.

Este é um monorepo que contém:
- **backend**: FastAPI (Python)
- **frontend**: React + Vite (TypeScript)
- **Evolution API**: Gateway de conexões do WhatsApp.

## Pré-requisitos

- Docker e Docker Compose
- Node.js e pnpm
- uv (Python package manager)

## Configuração Local (Docker + Evolution API)

Para rodar o ambiente local com o gateway de mensagens Evolution API e o banco de dados Postgres:

1. Configure as variáveis de ambiente:
   ```bash
   cp .env.evolution.example .env.evolution
   ```

2. Subir infraestrutura (bancos e Evolution API):
   ```bash
   docker compose up -d
   ```

3. Ver logs da Evolution API:
   ```bash
   docker logs -f evolution_api
   ```

4. Testar a Evolution API:
   ```bash
   curl http://localhost:8080
   ```

5. Testar os containers:
   ```bash
   docker ps
   ```

### Notas sobre a Rede Docker
Dentro da rede Docker, os containers não se comunicam via `localhost`. É essencial utilizar os hostnames definidos no `docker-compose.yml`:
- Use `postgres_evolution` para conectar a Evolution API ao seu banco Postgres.
- Use `redis_evolution` para a Evolution conectar ao Redis.
- Use `localhost` apenas quando estiver acessando esses serviços a partir da máquina host (seu computador).

## Configuração do Backend

Consulte o [README do Backend](backend/README.md) para detalhes de instalação e inicialização. Resumo:

1. Crie o arquivo `.env`:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Instale dependências e rode migrations:
   ```bash
   uv sync
   uv run alembic upgrade head
   uv run python -m app.seed
   ```
3. Inicie o servidor dev:
   ```bash
   uv run fastapi dev app/main.py
   ```

## Configuração do Frontend

Consulte o [README do Frontend](frontend/README.md) para detalhes. Resumo:

1. Instale as dependências:
   ```bash
   cd frontend
   pnpm install
   ```
2. Inicie o servidor:
   ```bash
   pnpm dev
   ```
