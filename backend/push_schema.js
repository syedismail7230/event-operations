const { Signer } = require('@aws-sdk/rds-signer');
const cp = require('child_process');
const fs = require('fs');

async function push() {
  console.log('Generating IAM Token for Prisma DB Push...');
  const signer = new Signer({
    hostname: 'database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com',
    port: 5432,
    username: 'postgres',
    region: 'ap-southeast-2'
  });
  
  const token = await signer.getAuthToken();
  const encodedToken = encodeURIComponent(token);
  const url = `postgresql://postgres:${encodedToken}@database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com:5432/postgres?schema=public&sslmode=require`;
  
  const originalEnv = fs.readFileSync('.env', 'utf8');
  let newEnv = originalEnv.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${url}"`);
  fs.writeFileSync('.env', newEnv);
  
  try {
    console.log('Running npx prisma db push...');
    cp.execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('Schema pushed successfully!');
  } catch (err) {
    console.error('Failed to push schema', err.message);
  } finally {
    fs.writeFileSync('.env', originalEnv);
    console.log('Restored .env');
  }
}

push();
