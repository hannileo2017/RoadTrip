// checkRoutes.js
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, 'routes');

function checkRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const report = {
    file: path.basename(filePath),
    usesSupabaseStorage: /supabase\.storage/.test(content),
    hasImageUpload: /(photoBase64|LogoBase64)/.test(content),
    deletesFromStorage: /\.remove\(/.test(content),
    generatesIDManually: /generateDriverID/.test(content),
    notes: []
  };

  if (!report.usesSupabaseStorage && report.hasImageUpload) {
    report.notes.push('يوجد رفع صور ولكن لا يستخدم Supabase Storage.');
  }
  if (report.usesSupabaseStorage && !report.deletesFromStorage) {
    report.notes.push('يستخدم Supabase Storage ولكن لا يوجد حذف للصورة عند حذف السجل.');
  }

  return report;
}

fs.readdir(ROUTES_DIR, (err, files) => {
  if (err) return console.error('❌ Failed to read routes directory:', err.message);

  const jsFiles = files.filter(f => f.endsWith('.js'));
  const reports = jsFiles.map(f => checkRouteFile(path.join(ROUTES_DIR, f)));

  console.log('===== Routes Check Report =====');
  reports.forEach(r => {
    console.log(`\nFile: ${r.file}`);
    console.log('Uses Supabase Storage:', r.usesSupabaseStorage);
    console.log('Has Image Upload:', r.hasImageUpload);
    console.log('Deletes Images from Storage:', r.deletesFromStorage);
    console.log('Generates ID Manually:', r.generatesIDManually);
    if (r.notes.length) console.log('Notes:', r.notes.join(' | '));
  });
});
