# Agency OS Frontend

Last updated: July 26, 2026

This is the standalone Next.js frontend for Agency OS. It currently covers the customer acquisition and activation journey for a new agency founder.

## Current implementation status

The frontend now includes:

- A marketing landing page for AGENCIE with a polished hero and product narrative.
- A `/login` experience that exchanges a Google credential with the backend auth endpoint.
- A local development fallback so the auth experience can be tested even before a real Google client ID exists.
- A `/create-agency` flow that captures the agency name, normalizes the slug, and routes the founder into their workspace.
- A branded workspace shell at `/{agencySlug}` with an activation-first dashboard and auth protection.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 to view the app.

## Documentation

- [Frontend status - July 26, 2026](./docs/2026-07-26-frontend-status.md)
- [Frontend Phase 1 RFC](./docs/2026-07-26-frontend-phase-1-rfc.md)
