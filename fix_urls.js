const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files.push(...walk(full));
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) files.push(full);
  }
  return files;
}

const srcDir = path.join(__dirname, 'frontend', 'src');
let count = 0;

for (const file of walk(srcDir)) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('NEXT_PUBLIC_API_PLACEHOLDER')) {
    // Replace placeholder back to proper env var template literal value
    content = content.replace(/NEXT_PUBLIC_API_PLACEHOLDER/g, "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}");
    fs.writeFileSync(file, content, 'utf8');
    count++;
    console.log('Fixed:', path.relative(srcDir, file));
  }
}
console.log(`\nTotal: ${count} files updated.`);
