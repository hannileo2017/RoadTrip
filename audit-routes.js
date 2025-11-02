// audit-fix-routes.js
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, 'routes'); // مجلد الروتس
const SUPABASE_PATH = '../supabase'; // غيّر إذا مسار supabase مختلف

function fixRouteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  if (!/const express\s*=/.test(content)) {
    content = `const express = require('express');\n` + content;
    modified = true;
  }

  if (!/const router\s*=/.test(content)) {
    content = `const router = express.Router();\n` + content;
    modified = true;
  }

  if (!/const supabase\s*=/.test(content)) {
    content = `const supabase = require('${SUPABASE_PATH}');\n` + content;
    modified = true;
  }

  if (!/module\.exports\s*=\s*router;/.test(content)) {
    content += `\nmodule.exports = router;\n`;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${filePath}`);
  } else {
    console.log(`ℹ️ Already OK: ${filePath}`);
  }
}

function scanRoutes(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanRoutes(fullPath);
    } else if (file.endsWith('.js')) {
      fixRouteFile(fullPath);
    }
  });
}

scanRoutes(ROUTES_DIR);
console.log('🎯 All routes scanned and fixed if needed.');
