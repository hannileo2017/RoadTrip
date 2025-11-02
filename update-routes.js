const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes'); // عدل لو مجلد الروتس عندك مختلف

// دالة لقراءة كل الملفات في المجلد
function updateRoutes(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // لو فيه مجلد فرعي، نعمله recursive
      updateRoutes(filePath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');

      // إزالة أي استخدام مباشر لـ supabaseKey أو إنشاء client داخل الروت
      content = content.replace(/const\s+supabase\s*=\s*createClient\(.*\);/gs, '');
      content = content.replace(/require\(['"]@supabase\/supabase-js['"]\)/gs, "require('../supabase')");

      // إضافة require للـ client في أعلى الملف لو مش موجود
      if (!content.includes("const supabase = require('../supabase')")) {
        content = `const supabase = require('../supabase');\n` + content;
      }

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
    }
  });
}

updateRoutes(routesDir);
console.log('🎉 All routes updated!');
