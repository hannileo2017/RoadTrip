const fs = require('fs');
const path = require('path');

// كل ملفات routes و middlewares
const directoriesToScan = ['routes', 'middlewares'];
const packageJson = require('./package.json');
const allDependencies = Object.keys(packageJson.dependencies || {});

let report = {
  scannedFiles: 0,
  missingPackages: new Set(),
  missingLocalModules: [],
  missingEnvVars: new Set(),
  filesStatus: []
};

// دالة لفحص ملف واحد
function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileReport = { file: filePath, issues: [] };

  // التأكد من وجود const express / router / supabase
  if (!/const express\s*=\s*require\(['"]express['"]\)/.test(content)) {
    fileReport.issues.push('Missing: const express');
  }
  if (!/const router\s*=\s*express\.Router\(\)/.test(content)) {
    fileReport.issues.push('Missing: const router');
  }
  if (/supabase/.test(content) && !/const supabase\s*=/.test(content)) {
    fileReport.issues.push('supabase used but not defined');
  }

  // التأكد من imports packages موجودة في package.json
  const requireRegex = /require\(['"](.+?)['"]\)/g;
  let match;
  while ((match = requireRegex.exec(content)) !== null) {
    const mod = match[1];
    if (!mod.startsWith('.') && !allDependencies.includes(mod)) {
      report.missingPackages.add(mod);
    }
  }

  // التأكد من imports المحلية موجودة
  const relativeImports = [...content.matchAll(/require\(['"](\.\/.+?|..\/.+?)['"]\)/g)];
  for (const m of relativeImports) {
    const relPath = path.resolve(path.dirname(filePath), m[1]) + '.js';
    if (!fs.existsSync(relPath)) {
      report.missingLocalModules.push({ file: filePath, missingModule: m[1] });
    }
  }

  // التأكد من استخدام env vars
  const envMatches = [...content.matchAll(/process\.env\.([A-Z0-9_]+)/g)];
  for (const m of envMatches) {
    if (!process.env[m[1]]) {
      report.missingEnvVars.add(m[1]);
    }
  }

  report.filesStatus.push(fileReport);
  report.scannedFiles++;
}

// دالة مسح مجلد
function scanDirectory(dir) {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) return;
  const files = fs.readdirSync(fullPath);
  for (const file of files) {
    const filePath = path.join(fullPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      scanDirectory(path.join(dir, file));
    } else if (file.endsWith('.js')) {
      auditFile(filePath);
    }
  }
}

// المسح
directoriesToScan.forEach(scanDirectory);

// كتابة التقرير
fs.writeFileSync('audit-all-report.json', JSON.stringify(report, null, 2));
console.log('✅ Audit completed.');
console.log(`Files scanned: ${report.scannedFiles}`);
if (report.missingPackages.size) {
  console.log('Missing packages in package.json:', Array.from(report.missingPackages));
}
if (report.missingLocalModules.length) {
  console.log('Missing local modules:', report.missingLocalModules);
}
if (report.missingEnvVars.size) {
  console.log('Missing env vars:', Array.from(report.missingEnvVars));
}
console.log('Detailed JSON report written to ./audit-all-report.json');
