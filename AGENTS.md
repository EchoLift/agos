# AGENTS.md

## Repo Overview

AGOS is a **multi-tenant SaaS platform for creative agencies** — an operating system for content production. Monorepo with an independent NestJS backend and Next.js frontend. No root-level package.json or workspace manager.

## Structure

```
/
├── backend/          # NestJS monorepo (TypeScript)
│   ├── apps/api      # REST API (port 4000)
│   ├── apps/worker   # Background queue consumer
│   ├── apps/websocket # Socket.IO server (port 4001)
│   ├── modules/      # 12 business domain modules
│   ├── packages/     # 9 shared infra packages
│   ├── prisma/       # Prisma ORM schema + migrations
│   └── docker-compose.yml   # Postgres, Redis, RabbitMQ
├── frontend/         # Next.js 16 (App Router, React 19, Tailwind v4)
├── run-servers.sh    # Starts backend API + frontend dev
└── AgencyOs_context.md
└── Dev_Methodology.md
```

## Dev Commands

### Backend (from `backend/`)

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev:api          # API on :4000
npm run dev:worker       # Queue consumer
npm run dev:websocket    # WebSocket on :4001
npm run build            # Build all 3 apps
npm run lint             # ESLint across apps, modules, packages
npm run format           # Prettier
```

Run tests directly: `npx jest` (no `test` script in package.json).
TypeScript checking: implicit via `nest build` (no `typecheck` script).

### Frontend (from `frontend/`)

```bash
npm install
npm run dev              # Next.js on :3000
npm run build
npm run lint
```

No test framework or typecheck script configured in frontend.

### Combined

```bash
./run-servers.sh         # Backend API in background + frontend in foreground
```

## Architecture

- **Backend**: NestJS v11, Prisma v6, PostgreSQL 16, Redis 7, RabbitMQ 3, Socket.IO v4
- **Path aliases**: `@modules/*` → `modules/*`, `@packages/*` → `packages/*` (backend)
- **`@/*`** → `./src/*` (frontend)
- **Auth**: JWT access token + opaque HttpOnly refresh token + Google OAuth + Argon2id + AES-256 field encryption
- **Multi-tenancy**: `agencyId` on all business models; `TenantGuard` resolves tenant per request
- **Event-driven**: RabbitMQ + outbox pattern via `packages/events/`
- **Security**: JwtAuthGuard, TenantGuard, PermissionsGuard applied globally on API
- **Soft delete** via `deletedAt`, **optimistic locking** via `version`

## Key Conventions

- **Vertical slice development** — every feature includes DB, repository, service, controller, DTOs, tests, Swagger, domain events, and docs.
- **Business logic in services**, repositories are DB-only, controllers stay thin.
- **Every write** emits domain events.
- **No duplicate business logic**. No unnecessary abstraction. No premature optimization.
- **Decision priority**: Simplicity → Maintainability → Readability → Security → Scalability → Performance.
- **Kanban WIP limit**: 1 active module, 1 active feature, 1 active architectural change.
- **Definition of Done**: business rules + tests + build + Swagger + domain events + logging + error handling + security review + docs.

## Infrastructure

Run via Docker Compose: `cd backend && docker-compose up -d` (Postgres 16, Redis 7, RabbitMQ 3).

## Existing Instruction Files

- `frontend/AGENTS.md` — Auto-generated Next.js agent rules (do not edit)
- `frontend/CLAUDE.md` — Delegates to `@AGENTS.md`
- `backend/README.md` — Backend setup commands and docs links
- `backend/docs/` — LLD, event catalog, state machine, API contract, and more

## Important Notes

- No CI/CD config, no pre-commit hooks, no root lockfile.
- No `test` or `typecheck` scripts in either `package.json` — run directly.
- The `\` file at root is an `opencode.json` containing an AI provider API key — do not commit or share it.