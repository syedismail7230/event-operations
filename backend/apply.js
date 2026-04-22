const fs = require('fs');

const files = [
  'src/server.ts',
  'src/middleware/auth.middleware.ts',
  'src/controllers/geofence.controller.ts',
  'src/controllers/event.controller.ts',
  'src/controllers/dashboard.controller.ts',
  'src/controllers/auth.controller.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ PrismaClient \} from '@prisma\/client';/g, '');
  content = content.replace(/const prisma = new PrismaClient\(\);/g, file === 'src/server.ts' ? "import prisma from './lib/prisma';" : "import prisma from '../lib/prisma';");
  fs.writeFileSync(file, content);
});
console.log('Applied Proxy to all files');
