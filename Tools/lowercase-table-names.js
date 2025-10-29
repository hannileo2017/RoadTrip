/**
 * tools/lowercase-table-names.js
 *
 * يمر على مجلد routes ويحوّل أسماء الجداول المكتوبة بأحرف كبيرة
 * إلى أحرف صغيرة في الأماكن الشائعة:
 *  - supabase.from('TableName') / .from("TableName") / .from(`TableName`)
 *  - SQL: FROM "TableName"  أو  FROM TableName
 *
 * يحفظ نسخة احتياطية لكل ملف كـ <filename>.bak قبل التعديل.
 * يطبع تقرير التغييرات في النهاية.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..'); // ضبط حسب مكان الملف
const routesDir = path.join(projectRoot, 'routes');

if (!fs.existsSync(routesDir)) {
  console.error('❌ مجلد routes غير موجود:', routesDir);
  process.exit(1);
}

function walkJsFiles(dir) {
  const acc = [];
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) acc.push(...walkJsFiles(p));
    else if (f.endsWith('.js')) acc.push(p);
  });
  return acc;
}

/**
 * يقوم بتحويل اسم الجدول إلى lowercase عند وجوده داخل supabase.from(...)
 * وكذلك يحاول تعديل عبارات SQL FROM "Table" و FROM Table
 */
function transformContent(original) {
  let changed = false;
  let content = original;

  // 1) supabase.from(...)  => normalize to single quotes and lowercase the table name
  //    matches: .from('TableName'), .from("TableName"), .from(`TableName`)
  const fromRegex = /(\.from\s*\(\s*)(['"`])([A-Za-z0-9_]+)\2(\s*\))/g;
  content = content.replace(fromRegex, (m, pre, quote, tbl, post) => {
    const lower = tbl.toLowerCase();
    if (tbl !== lower) changed = true;
    // use single quotes consistently
    return `${pre}'${lower}'${post}`;
  });

  // 2) SQL: FROM "TableName"  -> FROM "tablename"
  //    Note: preserve quotes style if present
  const fromQuotedRegex = /(\bFROM\s+)(["'])([A-Za-z0-9_]+)\2/gi;
  content = content.replace(fromQuotedRegex, (m, pre, q, tbl) => {
    const lower = tbl.toLowerCase();
    if (tbl !== lower) changed = true;
    return `${pre}${q}${lower}${q}`;
  });

  // 3) SQL: FROM TableName  -> FROM tablename  (only bare identifiers, avoid changing things inside other contexts)
  //    Use word boundary and avoid changing if followed by . or ( which might be different constructs
  const fromBareRegex = /(\bFROM\s+)(`?)([A-Za-z][A-Za-z0-9_]*)\2/gi;
  content = content.replace(fromBareRegex, (m, pre, backtick, tbl) => {
    // if it's already lowercase or it's a SQL keyword, skip
    const lower = tbl.toLowerCase();
    if (tbl === lower) return m; // no change
    // avoid changing common SQL keywords accidentally (e.g., FROM ONLY, FROM LATERAL unlikely but safe)
    const sqlKeywords = new Set(['only','lateral']);
    if (sqlKeywords.has(lower)) return m;
    changed = true;
    return `${pre}${lower}`;
  });

  // 4) also adjust occurrences like JOIN "TableName" or JOIN TableName
  const joinQuotedRegex = /(\bJOIN\s+)(["'])([A-Za-z0-9_]+)\2/gi;
  content = content.replace(joinQuotedRegex, (m, pre, q, tbl) => {
    const lower = tbl.toLowerCase();
    if (tbl !== lower) changed = true;
    return `${pre}${q}${lower}${q}`;
  });
  const joinBareRegex = /(\bJOIN\s+)([A-Za-z][A-Za-z0-9_]*)/gi;
  content = content.replace(joinBareRegex, (m, pre, tbl) => {
    const lower = tbl.toLowerCase();
    if (tbl === lower) return m;
    changed = true;
    return `${pre}${lower}`;
  });

  return { content, changed };
}

const files = walkJsFiles(routesDir);
const changes = [];

files.forEach(file => {
  try {
    const original = fs.readFileSync(file, 'utf8');
    const { content, changed } = transformContent(original);
    if (changed) {
      // backup
      const bak = file + '.bak';
      if (!fs.existsSync(bak)) {
        fs.writeFileSync(bak, original, 'utf8');
      } else {
        // إذا النسخة الاحتياطية موجودة، لا نُعيد كتابتها لكي لا نخرب القديم
      }
      fs.writeFileSync(file, content, 'utf8');
      changes.push(file);
      console.log(`✅ Modified: ${file}  (backup: ${bak})`);
    }
  } catch (err) {
    console.error(`❌ Failed processing ${file}:`, err.message);
  }
});

console.log('\n---- Summary ----');
if (changes.length === 0) {
  console.log('No files changed.');
} else {
  console.log(`Files updated (${changes.length}):`);
  changes.forEach(f => console.log(' -', f));
}
console.log('Done.');
