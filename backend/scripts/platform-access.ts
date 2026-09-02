import { PrismaClient, SubscriptionStatus } from "@prisma/client";

const prisma = new PrismaClient();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.split("=");
    return [key, value.join("=")];
  }),
);

async function main() {
  if (args.get("--confirm") !== "yes")
    throw new Error("Refusing to write without --confirm=yes");
  const action = args.get("--action");
  if (action === "grant-admin") {
    const authUserId = args.get("--auth-user-id");
    if (!authUserId) throw new Error("--auth-user-id is required");
    const user = await prisma.user.findUnique({
      where: { authUserId },
      select: { id: true, authUserId: true, platformRole: true },
    });
    if (!user) throw new Error("No user exists for that auth user ID");
    console.log(
      await prisma.user.update({
        where: { id: user.id },
        data: { platformRole: "ADMIN" },
        select: { id: true, authUserId: true, platformRole: true },
      }),
    );
    return;
  }
  if (action === "pilot-trial") {
    const slug = args.get("--agency-slug");
    const rawEnd = args.get("--trial-ends-at");
    if (!slug || !rawEnd)
      throw new Error("--agency-slug and --trial-ends-at are required");
    const trialEndsAt = new Date(rawEnd);
    if (!Number.isFinite(trialEndsAt.getTime()) || trialEndsAt <= new Date())
      throw new Error("Trial end must be a valid future timestamp");
    const agency = await prisma.agency.findUnique({
      where: { slug },
      select: { id: true, slug: true, displayName: true },
    });
    if (!agency) throw new Error("No agency exists for that exact slug");
    const result = await prisma.$transaction(async (tx) => {
      const subscription = await tx.agencySubscription.upsert({
        where: { agencyId: agency.id },
        update: {
          status: SubscriptionStatus.TRIAL,
          plan: "PILOT",
          trialEndsAt,
          startsAt: new Date(),
          endsAt: null,
          version: { increment: 1 },
        },
        create: {
          agencyId: agency.id,
          status: SubscriptionStatus.TRIAL,
          plan: "PILOT",
          trialEndsAt,
          startsAt: new Date(),
        },
        select: {
          id: true,
          agencyId: true,
          status: true,
          plan: true,
          trialEndsAt: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          agencyId: agency.id,
          eventType: "AgencyEntitlementUpdated",
          entityType: "AgencySubscription",
          entityId: subscription.id,
          metadataJson: {
            status: "TRIAL",
            plan: "PILOT",
            trialEndsAt: trialEndsAt.toISOString(),
            source: "platform-access-cli",
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          agencyId: agency.id,
          aggregateId: subscription.id,
          aggregateType: "AgencySubscription",
          eventType: "AgencyEntitlementUpdated",
          payload: {
            agencyId: agency.id,
            status: "TRIAL",
            plan: "PILOT",
            trialEndsAt: trialEndsAt.toISOString(),
            source: "platform-access-cli",
            occurredAt: new Date().toISOString(),
          },
        },
      });
      return subscription;
    });
    console.log(result);
    return;
  }
  throw new Error("Use --action=grant-admin or --action=pilot-trial");
}

main().finally(() => prisma.$disconnect());
