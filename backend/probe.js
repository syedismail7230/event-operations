const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    console.log("Attempting database connection...");
    const count = await prisma.user.count();
    console.log("Success! Users count:", count);
  } catch (err) {
    console.error("Database connection failed:");
    console.error(err.message);
  } finally {
    await prisma.$disconnect();
  }
}
check();
