const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const backupDir = path.join(__dirname, `routes-backup-${new Date().toISOString().replace(/[:.]/g,'-')}`);
fs.mkdirSync(backupDir, { recursive: true });

fs.readdirSync(routesDir).forEach(file => {
  if (!file.endsWith('.js')) return;
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Backup original
  fs.writeFileSync(path.join(backupDir, file), content);

  let updated = content;

  // 1️⃣ إصلاح مشكلة supabaseKey
  if (!/SUPABASE_SERVICE_KEY/.test(updated)) {
    updated = updated.replace(
      /(const supabase\s*=\s*createClient\()[^\)]*\)/,
      `process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`
    );
  }

  // 2️⃣ تجنب إعادة تعريف supabase
  updated = updated.replace(/const\s+supabase\s*=\s*createClient/g, `if (!global.supabase) { global.supabase = createClient`);
  updated = updated.replace(/\);$/, `); }`);

  // 3️⃣ إصلاح Syntax بسيطة: أي ) مفقودة
  const openParens = (updated.match(/\(/g) || []).length;
  const closeParens = (updated.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    updated += ')'.repeat(openParens - closeParens);
  }

  fs.writeFileSync(filePath, updated);
  console.log(`✅ Fixed: ${file}`);
});

console.log(`🎯 Done. Backup created at ${backupDir}`);
