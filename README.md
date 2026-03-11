# Fluvius

Monorepo MVP SaaS para sistema de clínicas.

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

## Módulos Implementados

### Backend (apps/api)

- **clinics** - Gerenciamento de clínicas
- **users** - Usuários/atendentes
- **services** - Serviços oferecidos
- **conversations** - Conversas com clientes
- **messages** - Mensagens das conversas
- **appointments** - Agendamentos

### Shared (packages/shared)

- Enums: Role, ConversationStatus, MessageDirection, AppointmentStatus
- Schemas Zod para criação de entidades

## Instalação

```bash
pnpm install
```

## Configuração

### Banco de Dados

Copie o arquivo `.env.example` e configure as` para `.env variáveis:

```bash
cp apps/api/.env.example apps/api/.env
```

Edite o `DATABASE_URL` com suas credenciais do PostgreSQL.

### Gerar Prisma Client

```bash
cd apps/api
pnpm db:generate
```

### Criar Migration

```bash
cd apps/api
pnpm db:migrate
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

## Rotas da API

### Health
- `GET /health` - Health check

### Auth
- `POST /auth/login` - Login

### Clinics
- `POST /clinics` - Criar clínica
- `GET /clinics` - Listar clínicas
- `GET /clinics/:id` - Buscar clínica

### Users
- `POST /users` - Criar usuário
- `GET /users` - Listar usuários
- `GET /users/:id` - Buscar usuário

### Services
- `POST /services` - Criar serviço
- `GET /services` - Listar serviços
- `GET /services/:id` - Buscar serviço

### Conversations
- `POST /conversations` - Criar conversa
- `GET /conversations` - Listar conversas
- `GET /conversations/:id` - Buscar conversa

### Messages
- `POST /messages` - Criar mensagem
- `GET /messages?conversationId=` - Listar mensagens

### Appointments
- `POST /appointments` - Criar agendamento
- `GET /appointments` - Listar agendamentos
- `GET /appointments/:id` - Buscar agendamento

## Scripts

- `pnpm dev` - Roda frontend e backend
- `pnpm dev:web` - Roda apenas frontend
- `pnpm dev:api` - Roda apenas backend
- `pnpm build` - Build de todos os packages
- `pnpm typecheck` - Verifica tipos TypeScript
- `pnpm db:generate` - Gera Prisma Client
- `pnpm db:migrate` - Cria migrations
- `pnpm db:push` - Push schema para banco
