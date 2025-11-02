// add-const.js
// استخدام: node add-const.js
const fs = require('fs');
const path = require('path');

// مجلد الملفات التي تريد تعديلها
const ROUTES_DIR = path.join(__dirname, 'routes');

// التعريفات التي تريد إضافتها
const CONSTS_TO_ADD = `
const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { createClient } = require('../supabase');
`;

function processFile(filePath) {
  if (!filePath.endsWith('.js')) return;

  const content = fs.readFileSync(filePath, 'utf8');

  // تحقق إذا كانت التعريفات موجودة بالفعل
  if (content.includes('const express = require(\'express\')')) {
    console.log(`[SKIP] ${filePath} - already contains express const`);
    return;
  }

  // أضف التعريفات في الأعلى
  const newContent = CONSTS_TO_ADD + '\n' + content;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`[UPDATED] ${filePath}`);
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else {
      processFile(fullPath);
    }
  }
}

// نفّذ السكريبت
walkDir(ROUTES_DIR);
console.log('✅ Done adding consts to all JS files.');
