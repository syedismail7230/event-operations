const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    try {
      if (fs.statSync(full).isDirectory()) files.push(...walk(full));
      else if (f.endsWith('.tsx') || f.endsWith('.ts')) files.push(full);
    } catch(e) {}
  }
  return files;
}

const srcDir = path.join(__dirname, 'frontend', 'src');
let count = 0;

for (const file of walk(srcDir)) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Fix: inline fetch URLs that got mangled by PowerShell
  // Pattern: `${process.env.NEXT_PUBLIC_API_URL}/some/path` -> keep as is (correct)
  // Pattern: `NEXT_PUBLIC_API_PLACEHOLDER/some/path` -> fix
  if (content.includes('NEXT_PUBLIC_API_PLACEHOLDER')) {
    content = content.replace(/NEXT_PUBLIC_API_PLACEHOLDER/g, "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}");
    changed = true;
  }

  // Fix files that have ONLY inline replacements but no const API declaration
  // These need a proper const API at the top, and fetch calls using it
  // Check if file has scattered ${process.env.NEXT_PUBLIC_API_URL} but no const API
  const hasInlineEnvVar = content.includes('${process.env.NEXT_PUBLIC_API_URL}');
  const hasConstAPI = content.includes('const API =');

  if (hasInlineEnvVar && !hasConstAPI) {
    // Add const API declaration after 'use client'; or at top of file
    const apiConst = "const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';\n";
    if (content.startsWith("'use client'")) {
      // Insert after 'use client'; line
      content = content.replace(/('use client';?\n)/, `$1${apiConst}`);
    } else {
      content = apiConst + content;
    }
    // Replace all inline uses with the const
    content = content.replace(/`\$\{process\.env\.NEXT_PUBLIC_API_URL\}/g, '`${API}');
    changed = true;
  }

  // Fix files that have const API with process.env inline but messy
  if (content.includes("const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'")) {
    // Already good - make sure fetch calls use ${API} not inline env
    const newContent = content.replace(/`\$\{process\.env\.NEXT_PUBLIC_API_URL\}/g, '`${API}');
    if (newContent !== content) { content = newContent; changed = true; }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
    console.log('Fixed:', path.relative(srcDir, file));
  }
}
console.log(`\nTotal: ${count} files updated.`);
