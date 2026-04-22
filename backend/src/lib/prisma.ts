import { PrismaClient } from '@prisma/client';
import { Signer } from '@aws-sdk/rds-signer';

let activeClient: PrismaClient | null = null;

const region = 'ap-southeast-2';
const hostname = 'database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com';
const port = 5432;
const username = 'postgres';

async function instantiateNewClient(): Promise<PrismaClient> {
  const signer = new Signer({ hostname, port, username, region });
  const token = await signer.getAuthToken();
  const encodedToken = encodeURIComponent(token);
  const url = `postgresql://${username}:${encodedToken}@${hostname}:${port}/postgres?schema=public&sslmode=require`;

  const client = new PrismaClient({ datasources: { db: { url } } });
  await client.$connect();
  return client;
}

// Bootstrap with unlimited retries — backend will ALWAYS eventually connect
async function bootstrap(): Promise<void> {
  let attempt = 0;
  while (true) {
    try {
      attempt++;
      console.log(`[Prisma Proxy] Connecting to AWS RDS (attempt ${attempt})...`);
      activeClient = await instantiateNewClient();
      console.log('[Prisma Proxy] Connected successfully via AWS IAM.');
      return;
    } catch (err: any) {
      console.error(`[Prisma Proxy] Attempt ${attempt} failed: ${err.message}`);
      const wait = Math.min(attempt * 2000, 10000); // exponential backoff up to 10s
      console.log(`[Prisma Proxy] Retrying in ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// Rotate token every 14 minutes
setInterval(async () => {
  try {
    console.log('[Prisma Proxy] Rotating AWS IAM Token...');
    const newClient = await instantiateNewClient();
    const old = activeClient;
    activeClient = newClient;
    if (old) await old.$disconnect();
    console.log('[Prisma Proxy] Token rotated successfully.');
  } catch (err) {
    console.error('[Prisma Proxy] Token rotation failed:', err);
  }
}, 840_000);

export const prismaInitPromise = bootstrap();

// Proxy: forwards all calls to the active client once ready
const prismaProxy = new Proxy({} as any, {
  get: (_target, prop) => {
    if (!activeClient) {
      throw new Error('[Prisma Proxy] Database not yet initialized. A request arrived before the connection was established.');
    }
    const val = (activeClient as any)[prop];
    if (typeof val === 'function') return val.bind(activeClient);
    return val;
  }
});

export default prismaProxy as any;
