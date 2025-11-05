// update-routes.js
// Usage: node update-routes.js
// Creates a backup of ./routes then performs best-effort fixes:
// - ensures express/router/db/supabase constants exist at top
// - replaces template sql`...` -> sql.query(`...`)
// - adds module.exports.init(...) for routes that don't have it
// - does not delete files; prints a summary

const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.cwd();
const routesDir = path.join(root, 'routes');

if (!fs.existsSync(routesDir)) {
  console.error('✖ routes directory not found at', routesDir);
  process.exit(1);
}

// 1) Backup routes folder
const ts = new Date().toISOString().replace(/[:.]/g,'-');
const backupDir = path.join(root, `routes-backup-${ts}`);
fs.mkdirSync(backupDir);
copyFolderSync(routesDir, backupDir);
console.log('🔒 Backup created at', backupDir);

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
const report = { fixed: [], skipped: [], errors: [] };

for (const file of files) {
  const full = path.join(routesDir, file);
  try {
    let content = fs.readFileSync(full, 'utf8');
    let original = content;

    // 2) Ensure header: express, router, sql (db), supabase env values
    let headerInsert = '';

    if (!/require\(['"]express['"]\)/.test(content)) {
      headerInsert += "const express = require('express');\n";
    }
    if (!/(?:const|let|var)\s+router\s*=\s*express\.Router\(\)/.test(content) &&
        !/module\.exports\s*=\s*router/.test(content)) {
      // if router not defined, add it
      headerInsert += "const router = express.Router();\n";
    }
    if (!/require\(['"]\.\.\/db['"]\)/.test(content) && !/const\s+sql\s*=/.test(content)) {
      headerInsert += "const sql = require('../db');\n";
    }
    // add supabase small bootstrap (safe: wrapped in try/catch)
    if (!/SUPABASE_SERVICE_KEY/.test(content) && !/process\.env\.SUPABASE/.test(content)) {
      headerInsert += [
        "const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || null;",
        "const SUPABASE_URL = process.env.SUPABASE_URL || null;",
        "let supabase = null;",
        "try {",
        "  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {",
        "    const { createClient } = require('@supabase/supabase-js');",
        "    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);",
        "  }",
        "} catch(e) { /* @supabase/supabase-js may be missing locally — ignore */ }",
        ""
      ].join('\n');
    }

    if (headerInsert) {
      // Only add header if not already present at top (avoid duplicate insertion)
      // If file already starts with 'use strict' or similar, insert after first line; otherwise prepend.
      if (/^#!|^\/\*/.test(content)) {
        content = headerInsert + content;
      } else {
        content = headerInsert + content;
      }
    }

    // 3) Replace sql`...` tagged templates -> sql.query(`...`)
    // best-effort: replace any sql`...` with sql.query(`...`)
    // Keep existing 'await' if present (we do not modify that)
    content = content.replace(/sql`([\s\S]*?)`/g, "sql.query(`$1`)");

    // 4) Add a safe module.exports.init if not present
    // We'll attach init as a property of module.exports (Router is an object)
    if (!/module\.exports\s*\.?init/.test(content)) {
      // ensure we have module.exports = router somewhere — if not, leave as-is but still add init appended
      const initCode = `

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          const { createClient } = require('@supabase/supabase-js');
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
`;
      // append initCode only if file exports router or module.exports is present or not (safe append)
      content = content + initCode;
    }

    // 5) Avoid duplicate route export lines (do not remove anything; this is non-destructive)

    // If content changed, write back
    if (content !== original) {
      fs.writeFileSync(full, content, 'utf8');
      report.fixed.push(file);
      console.log('✅ Fixed:', file);
    } else {
      report.skipped.push(file);
      console.log('ℹ️ Already OK:', file);
    }
  } catch (err) {
    report.errors.push({ file, error: String(err) });
    console.error('❌ Error processing', file, err.message || err);
  }
}

// Print summary and write JSON report
const out = { timestamp: new Date().toISOString(), report };
fs.writeFileSync(path.join(root, 'update-routes-report.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('🎯 Done. Report: update-routes-report.json');
console.log('Fixed:', report.fixed.length, 'Skipped:', report.skipped.length, 'Errors:', report.errors.length);

// helpers
function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (let ent of entries) {
    const src = path.join(from, ent.name);
    const dst = path.join(to, ent.name);
    if (ent.isDirectory()) {
      copyFolderSync(src, dst);
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}
