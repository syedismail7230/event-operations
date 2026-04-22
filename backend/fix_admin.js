const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function fix() {
  const r = await prisma.user.updateMany({
    where: { email: 'hod.aiml@hkbk.edu.in' },
    data: { role: 'ORG_ADMIN', status: 'ACTIVE' }
  });
  console.log('Restored ORG_ADMIN role for hod.aiml@hkbk.edu.in. Count:', r.count);
  await prisma.$disconnect();
}
fix().catch(e => { console.error(e); process.exit(1); });
