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

  // 2. Hash default password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 3. Create Root Admin
  const rootAdmin = await prisma.user.upsert({
    where: { email: 'root@acme.com' },
    update: {},
    create: {
      email: 'root@acme.com',
      password: hashedPassword,
      name: 'System Root',
      role: 'ROOT_ADMIN',
    },
  });

  console.log('Created Root Admin:', rootAdmin.email);

  // 4. Create Org Admin
  const orgAdmin = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      email: 'admin@acme.com',
      password: hashedPassword,
      name: 'Acme Admin',
      role: 'ORG_ADMIN',
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
