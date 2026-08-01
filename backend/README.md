# Agency OS Backend

Last updated: July 26, 2026

Backend foundation for Agency OS, built as an event-driven modular monolith that can later extract modules into microservices.

## Current implementation status

The backend now supports the first local founder journey end to end:

- Auth endpoints for register, login, Google login, refresh, and logout are implemented under `/api/v1/auth`.
- Google login supports both real Google ID tokens and a local dev fallback token for environments without a configured client ID.
- The API is configured for frontend integration with CORS and cookie-based refresh handling.
- Core domain modules for organizations, clients, campaigns, content, workflow, and security are wired into the shared platform.
- The backend build passes locally and the auth endpoint has been verified in live requests.

## V1 Runtime

- `apps/api`: public REST API and gateway concerns
- `apps/worker`: queue consumers for notifications, audit, and background work
- `apps/websocket`: realtime broadcast process
- `modules/*`: strict business modules
- `packages/*`: shared infrastructure packages

## First Commands

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run dev:api
```

## Documentation

- [Low-Level Design](./Agency_OS_LLD.md)
- [Backend Foundation Log - July 20, 2026](./docs/2026-07-20-backend-foundation.md)
- [File Map - July 20, 2026](./docs/2026-07-20-file-map.md)
- [Event Catalog - July 20, 2026](./docs/2026-07-20-event-catalog.md)
- [Workflow State Machine - July 20, 2026](./docs/2026-07-20-state-machine.md)
- [API Contract - July 20, 2026](./docs/2026-07-20-api-contract.md)
- [Living API Documentation](./docs/api.md)
- [Google OAuth Implementation - July 26, 2026](./docs/2026-07-26-google-oauth.md)
