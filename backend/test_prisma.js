const { Signer } = require('@aws-sdk/rds-signer');
const { PrismaClient } = require('@prisma/client');

async function test() {
  try {
    const signer = new Signer({
      hostname: 'database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com',
      port: 5432,
      username: 'postgres',
      region: 'ap-southeast-2'
    });
    
    const token = await signer.getAuthToken();
    const encodedToken = encodeURIComponent(token);
    const url = `postgresql://postgres:${encodedToken}@database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com:5432/postgres?schema=public&sslmode=require`;
    
    const client = new PrismaClient({
      datasources: { db: { url } }
    });
    
    console.log('Connecting...');
    await client.$connect();
    console.log('Prisma connected successfully via dynamic IAM token!');
    await client.$disconnect();
  } catch(e) {
    console.error('Prisma connection error:', e);
  }
}

test();
