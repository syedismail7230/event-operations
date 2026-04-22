const cp = require('child_process');
const fs = require('fs');

// 1. Generate IAM Token
const token = cp.execSync('aws rds generate-db-auth-token --hostname database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com --port 5432 --region ap-southeast-2 --username postgres').toString().trim();
const encodedAuth = encodeURIComponent(token);
const tempUrl = `postgresql://postgres:${encodedAuth}@database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com:5432/postgres?schema=public&sslmode=require`;

// 2. Temporarily write it to .env
const envPath = './.env';
let envContent = fs.readFileSync(envPath, 'utf8');
envContent = envContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${tempUrl}"`);
fs.writeFileSync(envPath, envContent);

// 3. Connect Prisma & Change Password
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Connecting to database using fresh IAM token...');
    await prisma.$executeRawUnsafe(`ALTER USER postgres WITH PASSWORD 'EventOpsRoot2026!';`);
    console.log('Successfully set static master password on AWS RDS!');
    
    // 4. Update .env with the new permanent password
    const permanentUrl = `postgresql://postgres:EventOpsRoot2026!@database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com:5432/postgres?schema=public&sslmode=require`;
    envContent = envContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${permanentUrl}"`);
    fs.writeFileSync(envPath, envContent);
    console.log('Successfully wrote standard postgresql static URL to .env!');
  } catch(e) {
    console.error('Failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
