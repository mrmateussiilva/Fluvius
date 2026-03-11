# Fluvius

Monorepo MVP SaaS para sistema de clínicas com gestão de conversas, mensagens e agendamentos.

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

## Domínio do Fluvius

O sistema gerencia clínicas com as seguintes entidades:

- **Clinics** - Clínicas que usam o sistema
- **Users** - Atendentes e administradores das clínicas
- **Services** - Serviços oferecidos pelas clínicas (cortes, tratamentos, etc.)
- **Conversations** - Conversas com clientes (iniciadas via WhatsApp)
- **Messages** - Mensagens trocadas nas conversas
- **Appointments** - Agendamentos de serviços

## Módulos Implementados

### Backend (apps/api/src/modules)

Cada módulo segue a estrutura:
- `route.ts` - Rotas Fastify
- `schema.ts` - Schemas Zod
- `service.ts` - Lógica de acesso ao banco

### Shared (packages/shared)

- **Enums**: UserRole, ConversationStatus, MessageDirection, AppointmentStatus
- **Schemas Zod**: createClinicSchema, createUserSchema, createServiceSchema, createConversationSchema, createMessageSchema, createAppointmentSchema
- **Types**: Tipos inferidos dos schemas

## Instalação

```bash
pnpm install
```

## Configuração

### Banco de Dados

Copie o arquivo `.env.example` para `.env`:

```bash
cp apps/api/.env.example apps/api/.env
```

Edite o `DATABASE_URL` com suas credenciais do PostgreSQL.

### Gerar Prisma Client

```bash
cd apps/api
pnpm prisma:generate
```

### Criar Migration

```bash
cd apps/api
pnpm prisma:migrate
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
- `GET /users` - Listar usuários (filtro opcional: ?clinicId=)
- `GET /users/:id` - Buscar usuário

### Services
- `POST /services` - Criar serviço
- `GET /services` - Listar serviços (filtro opcional: ?clinicId=)
- `GET /services/:id` - Buscar serviço

### Conversations
- `POST /conversations` - Criar conversa
- `GET /conversations` - Listar conversas (filtros opcionais: ?clinicId=, ?status=)
- `GET /conversations/:id` - Buscar conversa

### Messages
- `POST /messages` - Criar mensagem
- `GET /messages?conversationId=` - Listar mensagens de uma conversa

### Appointments
- `POST /appointments` - Criar agendamento
- `GET /appointments` - Listar agendamentos (filtro opcional: ?clinicId=)
- `GET /appointments/:id` - Buscar agendamento

## Scripts

```bash
# Desenvolvimento
pnpm dev              # Roda frontend e backend
pnpm dev:web         # Roda apenas frontend
pnpm dev:api         # Roda apenas backend

# Build e typecheck
pnpm build           # Build de todos os packages
pnpm typecheck       # Verifica tipos TypeScript

# Prisma
cd apps/api
pnpm prisma:generate    # Gera Prisma Client
pnpm prisma:migrate     # Cria migrations
pnpm prisma:push        # Push schema para banco
pnpm prisma:studio      # Abre Prisma Studio
```
