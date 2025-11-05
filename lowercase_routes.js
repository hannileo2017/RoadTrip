// lowercase_routes.js
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, 'routes'); // مجلد الروتس
const BACKUP_DIR = path.join(__dirname, 'routes_backup');

// إنشاء نسخة احتياطية
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);
fs.readdirSync(ROUTES_DIR).forEach(file => {
  if (file.endsWith('.js')) {
    fs.copyFileSync(
      path.join(ROUTES_DIR, file),
      path.join(BACKUP_DIR, file)
    );
  }
});

console.log('✅ Backup completed in routes_backup/');

// دالة لتحويل أسماء الجداول والأعمدة داخل علامات اقتباس إلى أحرف صغيرة
function convertQuotesToLower(sqlText) {
  return sqlText.replace(/"([^"]+)"/g, (_, p1) => p1.toLowerCase());
}

// تعديل جميع ملفات .js
fs.readdirSync(ROUTES_DIR).forEach(file => {
  if (!file.endsWith('.js')) return;

  const filePath = path.join(ROUTES_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  const newContent = convertQuotesToLower(content);

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✏️  Updated: ${file}`);
  } else {
    console.log(`✔️  No changes needed: ${file}`);
  }
});

console.log('🎉 All routes processed. Check your files!');
