const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const routesDir = path.join(__dirname, '..', 'routes');

// قوائم الجداول المعروفة لتسهيل التعرف عليها في الروتس
const knownTables = [
    'users', 'drivers', 'stores', 'products', 'orders', 'orderitems', 'coupons', 'payments'
];

// الحصول على schema من Supabase
async function fetchSchema() {
    try {
        const { data: tables, error } = await supabase
            .from('pg_catalog.pg_tables')
            .select('tablename')
            .eq('schemaname', 'public');

        if (error) throw error;

        const schema = {};
        for (const table of tables) {
            const { data: columns, error: colErr } = await supabase
                .from('information_schema.columns')
                .select('column_name')
                .eq('table_name', table.tablename);

            if (colErr) throw colErr;

            schema[table.tablename.toLowerCase()] = columns.map(c => c.column_name.toLowerCase());
        }

        return schema;
    } catch (err) {
        console.error('❌ Error fetching schema:', err.message);
        return {};
    }
}

// البحث عن الجداول المستخدمة في الروتس
function getTablesFromContent(content) {
    const tables = [];
    knownTables.forEach(tbl => {
        const regex = new RegExp(`\\b${tbl}\\b`, 'i');
        if (regex.test(content)) tables.push(tbl);
    });
    return tables;
}

// فحص ملفات الروتس
async function checkRoutes() {
    const schema = await fetchSchema();
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    console.log('📝 تقرير الفحص المتقدم لجميع الروتس:');
    console.log('---------------------------------------');

    for (const file of files) {
        const fullPath = path.join(routesDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');

        const hasDotenv = content.includes("require('dotenv')");
        const hasCreateClient = content.includes('createClient(');

        const usedTables = getTablesFromContent(content);

        const missingTables = usedTables.filter(t => !Object.keys(schema).includes(t));

        console.log(`\n📄 Route: ${fullPath}`);
        console.log(`- Has dotenv: ${hasDotenv}`);
        console.log(`- Has createClient: ${hasCreateClient}`);
        console.log(`- Tables used: ${usedTables.join(', ') || 'none'}`);

        if (missingTables.length > 0) {
            console.log('⚠️ Missing tables in DB schema:', missingTables.join(', '));
        }

        // التحقق من الحقول الناقصة لكل جدول
        for (const tbl of usedTables) {
            if (schema[tbl]) {
                const missingColumns = []; 
                const regex = new RegExp(`${tbl}\\.([a-zA-Z0-9_]+)`, 'g');
                let match;
                while ((match = regex.exec(content)) !== null) {
                    const col = match[1].toLowerCase();
                    if (!schema[tbl].includes(col) && !missingColumns.includes(col)) {
                        missingColumns.push(col);
                    }
                }
                if (missingColumns.length > 0) {
                    console.log(`⚠️ Table '${tbl}' missing columns: ${missingColumns.join(', ')}`);
                }
            }
        }

        if (usedTables.length === 0) console.log('⚠️ No known tables used in this route.');
        console.log('---------------------------------------');
    }
}

checkRoutes();
