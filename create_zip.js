const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const output = fs.createWriteStream(path.join(__dirname, 'backend-v12.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`backend-v12.zip created: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

archive.on('error', err => { throw err; });
archive.pipe(output);

const backendDir = path.join(__dirname, 'backend');

// Bundle only source code and configs (no node_modules)
archive.directory(path.join(backendDir, 'dist'), 'dist');
archive.directory(path.join(backendDir, 'prisma'), 'prisma');
archive.directory(path.join(backendDir, '.ebextensions'), '.ebextensions');
archive.file(path.join(backendDir, 'package.json'), { name: 'package.json' });
archive.file(path.join(backendDir, 'Procfile'), { name: 'Procfile' });
archive.file(path.join(backendDir, '.env'), { name: '.env' });

archive.finalize();
