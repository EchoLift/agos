import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const demoPeople: Record<string, { name: string; mobile: string }> = {
  ADMIN: { name: 'Aarav Ops Lead', mobile: '+919100001001' },
  MANAGER: { name: 'Priya Client Manager', mobile: '+919100001002' },
  WRITER: { name: 'Anjali Script Writer', mobile: '+919100001003' },
  DOP: { name: 'Ravi DOP', mobile: '+919100001004' },
  EDITOR: { name: 'Kiran Video Editor', mobile: '+919100001005' },
  DESIGNER: { name: 'Meera Designer', mobile: '+919100001006' },
  CLIENT: { name: 'Nisha Client Reviewer', mobile: '+919100001007' },
  FINANCE: { name: 'Farhan Finance', mobile: '+919100001008' },
  HR: { name: 'Divya HR', mobile: '+919100001009' },
  MEMBER: { name: 'Kabir Creative Member', mobile: '+919100001010' },
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to seed encrypted demo employees.`);
  }
  return value;
}

function encryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET ?? process.env.FIELD_ENCRYPTION_KEY_BASE64;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET or FIELD_ENCRYPTION_KEY_BASE64 is required.');
  }
  return crypto.createHash('sha256').update(secret).digest('hex').substring(0, 64);
}

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(encryptionKey(), 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function hashLookup(text: string) {
  return crypto.createHmac('sha256', requiredEnv('FIELD_LOOKUP_SECRET')).update(text).digest('hex');
}

async function upsertDemoMember(
  agencyId: string,
  agencySlug: string,
  inviterMembershipId: string,
  role: { id: string; displayName: string; systemRole: { key: string } },
) {
  const profile = demoPeople[role.systemRole.key];
  if (!profile) return false;

  const email = `${role.systemRole.key.toLowerCase()}-${agencySlug}@demo.agos.local`;
  const emailHash = hashLookup(email);

  const authUser = await prisma.authUser.upsert({
    where: { emailHash },
    update: {
      emailEncrypted: encrypt(email),
      status: 'ACTIVE',
    },
    create: {
      emailHash,
      emailEncrypted: encrypt(email),
      status: 'ACTIVE',
      passwordHash: null,
    },
  });

  const user = await prisma.user.upsert({
    where: { authUserId: authUser.id },
    update: {
      name: profile.name,
    },
    create: {
      authUserId: authUser.id,
      name: profile.name,
      timezone: 'Asia/Kolkata',
      language: 'en',
    },
  });

  const existingMembership = await prisma.membership.findUnique({
    where: {
      agencyId_userId: {
        agencyId,
        userId: user.id,
      },
    },
  });

  const membership = existingMembership
    ? await prisma.membership.update({
        where: { id: existingMembership.id },
        data: {
          roleId: role.id,
          status: 'ACTIVE',
          deletedAt: null,
          roles: {
            deleteMany: {},
            create: [{ roleId: role.id }],
          },
        },
      })
    : await prisma.membership.create({
        data: {
          agencyId,
          userId: user.id,
          roleId: role.id,
          status: 'ACTIVE',
          roles: {
            create: [{ roleId: role.id }],
          },
        },
      });

  await prisma.invitation.upsert({
    where: { token: `demo-${agencyId}-${role.systemRole.key}` },
    update: {
      mobileNumber: profile.mobile,
      status: 'ACCEPTED',
    },
    create: {
      agencyId,
      emailHash,
      roleId: role.id,
      invitedByMembershipId: inviterMembershipId,
      mobileNumber: profile.mobile,
      token: `demo-${agencyId}-${role.systemRole.key}`,
      expiresAt: new Date('2099-12-31T00:00:00.000Z'),
      status: 'ACCEPTED',
    },
  });

  return true;
}

async function main() {
  const agencies = await prisma.agency.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    include: {
      memberships: {
        where: {
          status: 'ACTIVE',
          roles: {
            some: {
              role: {
                systemRole: {
                  key: 'OWNER',
                },
              },
            },
          },
        },
        take: 1,
      },
      roles: {
        include: { systemRole: true },
        orderBy: { displayName: 'asc' },
      },
    },
  });

  if (agencies.length === 0) {
    console.log('No active agencies found. Create an agency first, then rerun this seed.');
    return;
  }

  for (const agency of agencies) {
    const ownerMembership = agency.memberships[0];
    if (!ownerMembership) {
      console.log(`Skipped ${agency.displayName || agency.name}: no active owner membership found.`);
      continue;
    }

    let created = 0;
    for (const role of agency.roles) {
      if (role.systemRole.key === 'OWNER') continue;
      const seeded = await upsertDemoMember(agency.id, agency.slug, ownerMembership.id, role);
      if (seeded) created += 1;
    }
    console.log(`Seeded ${created} demo employees for ${agency.displayName || agency.name}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
