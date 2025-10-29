// tools/check-routes-against-schema.js
// فحص الروتس مقابل schema في Supabase + استخراج اعمدة مستخدمة في .select(...) و SQL SELECT
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY / SUPABASE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const routesDir = path.join(__dirname, '..', 'routes'); // or adjust if script elsewhere

// helper: read all JS files under routesDir
function walkJsFiles(dir) {
  const out = [];
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) out.push(...walkJsFiles(fp));
    else if (f.endsWith('.js')) out.push(fp);
  });
  return out;
}

// helper: extract column names from supabase-js .select('col1,col2') occurrences
function extractSelectColumns(content) {
  const cols = new Set();
  // match .select('a,b,c') or .select("a,b")
  const selRegex = /\.select\s*\(\s*['"]([^'"]+)['"]\s*\)/gmi;
  let m;
  while ((m = selRegex.exec(content)) !== null) {
    const list = m[1].split(',').map(s => s.trim()).filter(Boolean);
    list.forEach(c => {
      // supabase can use related selects like "users(id,full_name)"
      const clean = c.replace(/\(.*\)/, '').trim();
      if (clean) cols.add(clean);
    });
  }

  // match SQL template SELECT col1, col2 FROM "Table"
  const sqlRegex = /SELECT\s+([\w\W]*?)\s+FROM\s+["'`]?([A-Za-z0-9_]+)["'`]?/gmi;
  while ((m = sqlRegex.exec(content)) !== null) {
    const colsPart = m[1];
    const items = colsPart.split(',').map(s => s.trim()).filter(Boolean);
    items.forEach(i => {
      // remove table aliases like t.col => get col
      const parts = i.split(/\s+/).pop().split('.');
      const name = parts[parts.length-1].replace(/["'`]/g, '').trim();
      if (name && !/^\*/.test(name)) cols.add(name);
    });
  }

  return Array.from(cols);
}

// get schema from information_schema.columns
async function fetchSchema() {
  // Use direct SQL via RPC using supabase's query: we can't use information_schema via supabase.from() normally
  // But Postgres allows selecting from information_schema; supabase-js allows RPC of SQL via 'postgres' direct? We'll try .rpc is not for raw SQL.
  // Instead use the Postgres SQL function 'pg_catalog.pg_tables' via supabase.from? It may not be allowed.
  // Simpler: use SQL via REST endpoint - but here we attempt via from('information_schema.columns')
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('table_name,column_name')
    .eq('table_schema','public')
    .limit(10000);

  if (error) {
    throw error;
  }
  const schema = {};
  data.forEach(r => {
    const t = r.table_name;
    const c = r.column_name;
    if (!schema[t]) schema[t] = new Set();
    schema[t].add(c);
  });

  // convert sets to arrays
  const out = {};
  Object.keys(schema).forEach(t => out[t] = Array.from(schema[t]));
  return out;
}

(async () => {
  console.log('🔎 Connecting to Supabase to fetch schema (using service key)...');
  let schema = null;
  try {
    schema = await fetchSchema();
    const tableCount = Object.keys(schema).length;
    console.log(`✅ Fetched schema. Tables found: ${tableCount}`);
  } catch (err) {
    console.error('❌ Error fetching schema:', (err && err.message) || err);
    console.error('→ تأكد أن المتغير SUPABASE_SERVICE_KEY في .env صحيح وأنه Service Role key');
    process.exit(1);
  }

  const files = walkJsFiles(routesDir);
  const report = [];

  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const hasDotenv = /require\(['"`]dotenv['"`]\)/.test(content);
    const hasCreateClient = /createClient\s*\(/.test(content);
    const usesSupabaseVar = /createClient\(|supabase\./.test(content);

    // find tables used by matching known table names (word boundary, case-insensitive)
    const usedTables = [];
    for (const tableName of Object.keys(schema)) {
      const re = new RegExp(`\\b${tableName}\\b`, 'i');
      if (re.test(content)) usedTables.push(tableName);
    }

    // columns used heuristics
    const usedColumns = extractSelectColumns(content);

    // compare usedColumns with each used table's columns
    const columnIssues = [];
    for (const t of usedTables) {
      const actualCols = schema[t] || [];
      const missingCols = usedColumns.filter(c => c && !actualCols.includes(c));
      if (missingCols.length) {
        columnIssues.push({ table: t, missing: missingCols });
      }
    }

    // also detect columns that might be global (used but table not detected)
    const orphanColumns = [];
    if (usedColumns.length && !usedTables.length) {
      // try to see which table could contain the column
      usedColumns.forEach(col => {
        const tablesWithCol = Object.entries(schema).filter(([t, cols]) => cols.includes(col)).map(([t]) => t);
        if (tablesWithCol.length === 0) orphanColumns.push(col);
      });
    }

    report.push({
      file: f,
      hasDotenv,
      hasCreateClient,
      usesSupabaseVar,
      usedTables,
      usedColumns,
      columnIssues,
      orphanColumns
    });
  }

  // Print report
  console.log('\n\n📝 Final report:\n');
  for (const r of report) {
    console.log('-----------------------------------------');
    console.log('File:', r.file.replace(process.cwd(), '.'));
    console.log('- has dotenv:', r.hasDotenv);
    console.log('- has createClient:', r.hasCreateClient);
    console.log('- uses supabase:', r.usesSupabaseVar);
    console.log('- tables detected in file:', r.usedTables.length ? r.usedTables.join(', ') : 'none');
    console.log('- columns detected (from .select / SQL):', r.usedColumns.length ? r.usedColumns.join(', ') : 'none');

    if (r.columnIssues.length) {
      console.log('  ⚠️ Column issues:');
      r.columnIssues.forEach(ci => {
        console.log(`     table ${ci.table} -> missing columns: ${ci.missing.join(', ')}`);
      });
    }
    if (r.orphanColumns.length) {
      console.log('  ⚠️ Columns referenced but not found in any table:', r.orphanColumns.join(', '));
    }
    if (!r.usedTables.length && !r.usedColumns.length && !r.usesSupabaseVar) {
      console.log('  Note: no supabase usage found in this file (may be config/helper).');
    }
  }

  console.log('\n✔️ Done.');
})();
