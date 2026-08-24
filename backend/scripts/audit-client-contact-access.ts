import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashEmail(email: string) {
  const secret = process.env.FIELD_LOOKUP_SECRET;
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(normalizeEmail(email))
    .digest("hex");
}

async function main() {
  const [
    clients,
    primaryWithoutAccess,
    invalidUserAccess,
    invalidClientAccess,
  ] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        agencyId: true,
        name: true,
        displayName: true,
        primaryContactUserId: true,
        primaryContactEmail: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<
      Array<{
        id: string;
        agencyId: string;
        name: string;
        displayName: string | null;
        primaryContactUserId: string;
      }>
    >`
      SELECT c."id", c."agencyId", c."name", c."displayName", c."primaryContactUserId"
      FROM "clients" c
      LEFT JOIN "client_user_accesses" cua
        ON cua."agencyId" = c."agencyId"
       AND cua."clientId" = c."id"
       AND cua."userId" = c."primaryContactUserId"
      WHERE c."deletedAt" IS NULL
        AND c."primaryContactUserId" IS NOT NULL
        AND cua."id" IS NULL
    `,
    prisma.$queryRaw<Array<{ id: string; agencyId: string; userId: string }>>`
      SELECT cua."id", cua."agencyId", cua."userId"
      FROM "client_user_accesses" cua
      LEFT JOIN "users" u ON u."id" = cua."userId"
      WHERE u."id" IS NULL OR u."deletedAt" IS NOT NULL
    `,
    prisma.$queryRaw<Array<{ id: string; agencyId: string; clientId: string }>>`
      SELECT cua."id", cua."agencyId", cua."clientId"
      FROM "client_user_accesses" cua
      LEFT JOIN "clients" c ON c."id" = cua."clientId"
      WHERE c."id" IS NULL OR c."deletedAt" IS NOT NULL
    `,
  ]);

  const clientsWithoutRelationalPrimary = clients.filter(
    (client) => !client.primaryContactUserId,
  );
  const unmappedPrimaryContactEmails: Array<{
    clientId: string;
    clientName: string;
    email: string | null;
    reason: string;
  }> = [];
  const deterministicEmailMatches: Array<{
    clientId: string;
    clientName: string;
    userId: string;
    email: string;
  }> = [];

  for (const client of clientsWithoutRelationalPrimary) {
    const email = client.primaryContactEmail?.trim() || null;
    const emailHash = email ? hashEmail(email) : null;
    const clientName = client.displayName || client.name;

    if (!email) {
      unmappedPrimaryContactEmails.push({
        clientId: client.id,
        clientName,
        email,
        reason: "No primaryContactEmail on client.",
      });
      continue;
    }

    if (!emailHash) {
      unmappedPrimaryContactEmails.push({
        clientId: client.id,
        clientName,
        email,
        reason: "FIELD_LOOKUP_SECRET is not configured; cannot map email.",
      });
      continue;
    }

    const matches = await prisma.authUser.findMany({
      where: { emailHash, deletedAt: null, user: { deletedAt: null } },
      select: { user: { select: { id: true } } },
    });

    const userIds = matches
      .map((match) => match.user?.id)
      .filter((id): id is string => Boolean(id));
    if (userIds.length === 1) {
      deterministicEmailMatches.push({
        clientId: client.id,
        clientName,
        userId: userIds[0],
        email,
      });
    } else {
      unmappedPrimaryContactEmails.push({
        clientId: client.id,
        clientName,
        email,
        reason:
          userIds.length === 0
            ? "No AGENCIE user matches primaryContactEmail."
            : "Multiple users match primaryContactEmail; manual resolution required.",
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        primaryWithoutAccess,
        clientsWithoutRelationalPrimary,
        deterministicEmailMatches,
        unmappedPrimaryContactEmails,
        invalidUserAccess,
        invalidClientAccess,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
