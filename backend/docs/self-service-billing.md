# Self-service billing and Cashfree PG

AGENCIE uses one-time Cashfree Payment Gateway orders; there are no subscriptions, mandates, or automatic debits. Prices and capacities are defined only in `billing.constants.ts`. A verified `PAYMENT_SUCCESS_WEBHOOK` is the only payment path that changes `AgencySubscription`.

## Configuration

Set `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, and `CASHFREE_ENVIRONMENT=sandbox|production` on the backend. Set `FRONTEND_URL` to the central application origin. Never expose Cashfree credentials to the frontend.

In Cashfree, whitelist the central application domain and configure the HTTPS webhook URL as `https://api.agencie.in/api/v1/billing/cashfree/webhook`. Enable payment success, failed, and user-dropped events. The implementation verifies the exact raw body signature and rejects timestamps outside five minutes.

## Backfill

Migration `20260905090000_add_self_service_billing` preserves all subscriptions and payments. It marks a user's lifetime trial as consumed only when an existing `AgencyCreated` outbox event identifies that user through its `createdBy` auth-user ID. OWNER membership is deliberately not used because ownership may be transferred. Existing agencies receive no new entitlement.

## Sandbox test

Apply migrations, configure Cashfree sandbox credentials, start API/frontend, sign in as an OWNER or FINANCE user, open `/billing`, select an agency and period, review the agency name, and use Cashfree sandbox checkout. Use Cashfree's webhook test/resend tooling against a publicly reachable HTTPS tunnel. The return page remains processing until the verified webhook durably marks the internal order paid.

## Deployment order

1. Back up the production database and verify `npx prisma migrate status`.
2. Deploy backend environment variables.
3. Run `npx prisma migrate deploy` once.
4. Deploy the backend and verify health/webhook reachability.
5. Whitelist the production central domain and enable the production webhook in Cashfree.
6. Deploy the frontend.
7. Complete one low-risk production order and verify payment, audit, outbox, and entitlement records.
