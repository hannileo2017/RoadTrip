const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes'); // مسار مجلد الروتس

fs.readdir(routesDir, (err, files) => {
  if (err) return console.error('Error reading routes folder:', err);

  files.forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(routesDir, file);
      let content = fs.readFileSync(filePath, 'utf8');

      // إضافة البداية إذا غير موجودة
      if (!content.includes("const express = require('express');")) {
        content = `const express = require('express');\nconst router = express.Router();\n` + content;
      }

      // إضافة supabase فقط إذا غير موجودة
      if (!content.includes("const supabase = require('../supabase');")) {
        content = `const supabase = require('../supabase');\n` + content;
      }

      // إضافة النهاية إذا غير موجودة
      if (!content.includes('module.exports = router;')) {
        content += '\nmodule.exports = router;\n';
      }

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${file}`);
    }
  });
});
