# Render Backend Deployment

Last updated: August 10, 2026

## What Failed

Render installed dependencies successfully, but the service failed at runtime because the compiled API file was not present:

```text
Cannot find module '/opt/render/project/src/backend/dist/apps/api/main.js'
```

There were two causes:

- The Render build command was only `yarn`, so the NestJS build never ran.
- The backend start scripts pointed to `dist/apps/api/main.js`, while the NestJS compiler outputs `dist/apps/api/src/main.js`.

## Render Service Settings

Use these settings for the API web service:

```text
Root Directory: backend
Build Command: npm ci && npm run build:render
Start Command: npm run start:api
Node Version: 22
```

Use npm, not Yarn, because the backend has `package-lock.json`.
The API reads Render's injected `PORT` automatically. `API_PORT` is still useful for local development, but Render should not need it.

## Worker Service

Create a separate background worker service:

```text
Root Directory: backend
Build Command: npm ci && npm run build:render
Start Command: npm run start:worker
Node Version: 22
```

The WebSocket server also reads Render's injected `PORT` automatically. `WEBSOCKET_PORT` is still useful for local development.

## WebSocket Service

Create a separate web service for realtime sockets:

```text
Root Directory: backend
Build Command: npm ci && npm run build:render
Start Command: npm run start:websocket
Node Version: 22
```

## Production Environment Variables

Required backend variables:

```text
NODE_ENV=production
DATABASE_URL=...
REDIS_URL=...
RABBITMQ_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
FIELD_ENCRYPTION_KEY_BASE64=...
FIELD_LOOKUP_SECRET=...
CORS_ORIGIN=https://your-frontend-domain
COOKIE_DOMAIN=your-domain
GOOGLE_CLIENT_ID=...
DEV_ROLE_TESTING_OVERRIDE_ENABLED=false
```

## Database Migrations

Run production migrations with:

```bash
npm run prisma:migrate:deploy
```

Do not use `prisma migrate dev` in production.
