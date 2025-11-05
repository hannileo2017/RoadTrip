// apply-supabase-client.js
// Run: node apply-supabase-client.js
// - Creates a backup routes-backup-before-supabase-patch-<ts>
// - For every file in /routes/*.js it:
//   * inserts "const { getSupabase } = require('../supabaseClient'); const supabase = getSupabase();" if not present
//   * removes repeated `const supabase = createClient(...)` and `const { createClient } = require('@supabase/supabase-js')`
//   * removes lines that explicitly throw 'supabaseKey is required' or similar
// NOTE: Always review backup before committing.

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const routesDir = path.join(root, 'routes');
if (!fs.existsSync(routesDir)) {
  console.error('routes directory not found:', routesDir);
  process.exit(1);
}

// backup
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backupDir = path.join(root, `routes-backup-before-supabase-patch-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.readdirSync(routesDir).forEach(f => {
  if (f.endsWith('.js')) {
    fs.copyFileSync(path.join(routesDir, f), path.join(backupDir, f));
  }
});
console.log('🔒 Backup of routes created at', backupDir);

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
const summary = { patched: [], skipped: [], errors: [] };

for (const file of files) {
  try {
    const p = path.join(routesDir, file);
    let src = fs.readFileSync(p, 'utf8');

    // If file already contains a safe require from supabaseClient, skip adding duplicate
    if (!/getSupabase\(|getSupabase\s*;/.test(src) && !/require\(['"]\.\.\/supabaseClient['"]\)/.test(src)) {
      // Insert after top requires (simple heuristic: after first block of require/const lines)
      const lines = src.split(/\r?\n/);
      let insertAt = 0;
      for (let i=0;i<Math.min(lines.length,30);i++){
        if (!/^\s*(const|let|var)\s+.*require\(/.test(lines[i]) && lines[i].trim() !== '') {
          insertAt = i;
          break;
        }
        insertAt = i+1;
      }
      const inject = "const { getSupabase } = require('../supabaseClient');\nconst supabase = getSupabase();\n";
      lines.splice(insertAt, 0, inject);
      src = lines.join('\n');
    }

    // Remove explicit createClient usage blocks (try to remove common patterns)
    // Remove "const { createClient } = require('@supabase/supabase-js');"
    src = src.replace(/const\s*\{\s*createClient\s*\}\s*=\s*require\(['"]@supabase\/supabase-js['"]\)\s*;?/g, '');

    // Remove lines that call createClient(...) into const supabase = createClient(...)
    src = src.replace(/const\s+supabase\s*=\s*createClient\([^;]+\);?/g, '');

    // Remove explicit throws about supabaseKey required
    src = src.replace(/if\s*\([^\)]*supabaseKey[^\)]*\)\s*\{\s*throw[^\}]+\}\s*/g, '');
    src = src.replace(/if\s*\([^\)]*(?:SUPABASE|supabase)[^\)]*\)\s*\{\s*throw[^\}]+\}\s*/gi, '');

    // Remove duplicate "const supabase =" definitions (if any remain)
    // But keep lines that only check supabase var usage
    src = src.replace(/(const|let|var)\s+supabase\s*=\s*[^;\n]+[;\n]?/g, function(m){
      // if this is the one we inserted earlier (getSupabase) leave it
      if (/getSupabase\(\)/.test(m)) return m;
      return ''; // remove other declarations
    });

    // Tidy up multiple consecutive blank lines
    src = src.replace(/\n{3,}/g, '\n\n');

    // Write back
    fs.writeFileSync(p, src, 'utf8');
    summary.patched.push(file);
    console.log('✅ Patched:', file);
  } catch (err) {
    summary.errors.push({ file, err: String(err) });
    console.error('❌ Error processing', file, err);
  }
}

fs.writeFileSync(path.join(root,'apply-supabase-patch-report.json'), JSON.stringify({ timestamp: new Date().toISOString(), summary }, null, 2));
console.log('🎯 Done. Report:', path.join(root,'apply-supabase-patch-report.json'));
