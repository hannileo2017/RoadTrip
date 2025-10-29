const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const routesDir = path.join(__dirname, 'routes');

// قائمة بأسماء الجداول المعروفة (يمكن تركها فارغة في البداية)
let tableNames = [];

// ======================
// جلب كل الجداول والأعمدة من Supabase
async function fetchTablesAndColumns() {
    const { data, error } = await supabase
        .from('information_schema.columns')
        .select('table_name,column_name')
        .eq('table_schema','public');

    if (error) {
        console.error('❌ Error fetching schema:', error.message);
        return {};
    }

    const schema = {};
    data.forEach(row => {
        if (!schema[row.table_name]) schema[row.table_name] = [];
        schema[row.table_name].push(row.column_name);
    });
    return schema;
}

// ======================
// فحص كل روت
async function checkRoutes() {
    const schema = await fetchTablesAndColumns();

    function getTablesUsed(content) {
        const used = [];
        for (const table of Object.keys(schema)) {
            const regex = new RegExp(`\\b${table}\\b`, 'i');
            if (regex.test(content)) used.push(table);
        }
        return used;
    }

    function walkDir(dir) {
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) walkDir(fullPath);
            else if (file.endsWith('.js')) processFile(fullPath);
        });
    }

    function processFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const hasDotenv = content.includes("require('dotenv')");
        const hasCreateClient = content.includes('createClient(');

        const tablesUsed = getTablesUsed(content);
        const missingTables = tablesUsed.filter(t => !schema[t]);

        console.log(`\n📝 Route: ${filePath}`);
        console.log(`- Has dotenv: ${hasDotenv}`);
        console.log(`- Has createClient: ${hasCreateClient}`);
        console.log(`- Tables used: ${tablesUsed.length ? tablesUsed.join(', ') : 'none'}`);
        if (missingTables.length) {
            console.log(`⚠️ Missing tables in DB: ${missingTables.join(', ')}`);
        }
        if (!tablesUsed.length) {
            console.log('⚠️ No known tables used in this route.');
        }
    }

    walkDir(routesDir);
}

checkRoutes();
