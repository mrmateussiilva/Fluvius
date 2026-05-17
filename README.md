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
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
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

## URLs no Ambiente Local

Use URLs diferentes conforme quem está fazendo a chamada:

- Browser/frontend -> backend FastAPI:
  - REST: `http://localhost:8000/api`
  - WebSocket: `ws://localhost:8000/ws?token=...`
- Evolution API container -> backend no host:
  - Webhook: `http://host.docker.internal:8000/webhooks/evolution/{connection_id}`
  - Fallback Linux, se `host.docker.internal` não resolver: `http://172.17.0.1:8000/webhooks/evolution/{connection_id}`
- Backend no host -> Evolution API:
  - `http://localhost:8080`
- Postgres/Redis entre containers:
  - use os nomes dos services Docker, como `postgres_evolution` e `redis_evolution`, nunca `localhost`.

O `docker-compose.yml` já inclui:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

No frontend local, mantenha:

```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
```

No backend local, mantenha:

```env
FRONTEND_ORIGIN=http://localhost:5173
PUBLIC_API_BASE_URL=http://localhost:8000
WEBHOOK_PUBLIC_BASE_URL=http://host.docker.internal:8000
EVOLUTION_BASE_URL=http://localhost:8080
EVOLUTION_API_KEY=...
```

## Deploy em Produção (VPS com Docker Compose e PostgreSQL)

O Fluvius possui uma infraestrutura própria (`docker-compose-sistema.yml`) para isolar o Postgres do sistema principal daquele utilizado pela Evolution API. Além disso, o Nginx é usado como proxy interno no Frontend, repassando requisições `/api` e `/ws` para o Backend internamente.

### 1. Iniciar o Sistema

1.  Certifique-se de que a Evolution API (via `docker-compose.yml`) já esteja rodando na sua máquina:
    ```bash
    docker compose up -d
    ```

2.  Suba o Sistema Fluvius (que subirá o seu próprio Postgres na rede Docker, o backend em FastAPI e o Nginx com React):
    ```bash
    docker compose -f docker-compose-sistema.yml up -d --build
    ```

> O Frontend será exposto na porta local `3000`. O Backend ficará na `8000`.

### 2. Configurar o Proxy Reverso (Caddy)

Você precisará usar um Proxy Reverso (como Caddy) para adicionar SSL (HTTPS) apontando o seu subdomínio para a porta `3000` do contêiner Frontend.
No seu arquivo `Caddyfile`, adicione o bloco abaixo:

```caddyfile
app.fluvius.com.br {
    reverse_proxy localhost:3000
}
```

O Frontend já está configurado via `nginx.conf` interno para direcionar as rotas da API:
*   Acesso a `/api/*` será reencaminhado para o backend.
*   Acesso a `/ws/*` será reencaminhado via Upgrade (WebSocket) para o backend.
*   Acesso a `/uploads/*` exibirá mídias armazenadas.

### 3. Variáveis de Ambiente e Arquivos de Upload

*   O banco PostgreSQL do sistema salva dados no volume persistente `pgdata`.
*   As mídias do WhatsApp recebidas são mantidas no disco via bind mount `./backend/uploads:/app/uploads`. Nunca exclua essa pasta, ou você perderá arquivos e áudios.
*   Antes de subir o sistema, configure o host publico do sistema para garantir que os Webhooks da Evolution alcancem o Backend:
    *   No Backend (no `.env`), altere `WEBHOOK_PUBLIC_BASE_URL=https://app.fluvius.com.br/api`
