# Subscriptions and platform administration

Workspace use requires an agency subscription that passes `EntitlementService`. Agency creation intentionally creates no entitlement.

## Database migration

Inspect first with `npx prisma migrate status`. If Prisma reports a modified applied migration or requests a reset, stop. Never reset or edit migration history. Once history is healthy, apply the new migration with:

```bash
npx prisma migrate deploy
```

## Grant platform administration

Find the intended user's `AuthUser.id` through a trusted database/admin channel. Do not use an agency role. Then run:

```bash
npm run platform:access -- --action=grant-admin --auth-user-id=<AUTH_USER_UUID> --confirm=yes
```

This prints only IDs and the resulting platform role. It does not expose email, hashes, or encrypted data.

## Activate the Socia Expert pilot

Confirm the exact existing agency slug and select an explicit ISO-8601 future end time. Then run:

```bash
npm run platform:access -- --action=pilot-trial --agency-slug=socia-expert --trial-ends-at=2026-12-31T23:59:59Z --confirm=yes
```

Replace the example date with the intended trial end. The command resolves the agency by its unique slug; it never guesses an ID and refuses invalid or past dates. It does not run automatically during deploy or seed.
