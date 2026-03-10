# Fluvius

Monorepo MVP SaaS.

## Estrutura

```
fluvius/
├── apps/
│   ├── web/          # Frontend React + Vite
│   └── api/          # Backend Fastify
├── packages/
│   └── shared/       # Tipos, schemas e enums compartilhados
├── pnpm-workspace.yaml
└── package.json
```

## Stack

- **Frontend**: React, Vite, React Router, Tailwind
- **Backend**: Fastify, Zod, Prisma
- **Database**: PostgreSQL
- **Package Manager**: pnpm

## Instalação

```bash
pnpm install
```

## Configuração

### Banco de Dados

Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
cp apps/api/.env.example apps/api/.env
```

Edite o `DATABASE_URL` com suas credenciais do PostgreSQL.

### Gerar Prisma Client

```bash
cd apps/api
pnpm db:generate
```

## Rodar o Projeto

### Desenvolvimento (ambos)

```bash
pnpm dev
```

### Apenas Frontend

```bash
pnpm dev:web
```

Frontend disponível em: http://localhost:3000

### Apenas Backend

```bash
pnpm dev:api
```

Backend disponível em: http://localhost:3001

## Prisma

### Criar migrations

```bash
cd apps/api
pnpm db:migrate
```

### Push schema para banco

```bash
cd apps/api
pnpm db:push
```

## Rotas da API

- `GET /health` - Health check
- `POST /auth/login` - Login

## Scripts

- `pnpm dev` - Roda frontend e backend
- `pnpm build` - Build de todos os packages
- `pnpm typecheck` - Verifica tipos TypeScript
