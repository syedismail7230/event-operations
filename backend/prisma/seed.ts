import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database...');

  // 1. Create a Master Organization
  const masterOrg = await prisma.organization.upsert({
    where: { id: 'org_master' }, // upsert needs unique field
    update: {},
    create: {
      name: 'Acme Event Corp',
    },
  });

  console.log('Created Organization:', masterOrg.name);

  // 2. Hash default password (if relying on local auth rollback at any point)
  const hashedPassword = await bcrypt.hash('dgywg%%^&556', 10);

  // 3. Create Root Admin (Zawar org)
  const rootAdmin = await prisma.user.upsert({
    where: { email: 'admin@zawr.org' },
    update: {},
    create: {
      email: 'admin@zawr.org',
      password: hashedPassword,
      name: 'Zawr Root Administrator',
      role: 'ROOT_ADMIN',
      status: 'ACTIVE'
    },
  });

  console.log('Created Root Admin:', rootAdmin.email);

  // 4. Create Org Admin (Pending Demo)
  const orgAdmin = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      email: 'admin@acme.com',
      password: await bcrypt.hash('password123', 10),
      name: 'Acme Admin',
      role: 'ORG_ADMIN',
      status: 'PENDING',
      organizationId: masterOrg.id,
    },
  });

  console.log('Created Org Admin:', orgAdmin.email);

  // 5. Create Test Event
  const testEvent = await prisma.event.create({
    data: {
      name: 'Tech Conference 2026',
      description: 'The biggest dev event of the year!',
      startTime: new Date(new Date().getTime() + 86400000), // tomorrow
      endTime: new Date(new Date().getTime() + 172800000), // day after tomorrow
      organizationId: masterOrg.id,
    },
  });

  console.log('Created Event:', testEvent.name);
  console.log('Finished Seeding Database.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
