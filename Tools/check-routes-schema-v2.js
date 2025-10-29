const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const routesDir = path.join(__dirname, '..', 'routes');

// ضع هنا أسماء الجداول الأساسية التي يجب أن تتواجد في الروتس
const knownTables = [
    'users', 'drivers', 'stores', 'products', 'orders', 'orderitems', 'coupons', 'payments'
];

// اختياري: تعريف الحقول الأساسية لكل جدول
const tableFields = {
    users: ['id', 'fullname', 'phone', 'email'],
    drivers: ['id', 'fullname', 'vehicle_type', 'available'],
    stores: ['id', 'name', 'category_id', 'city_id'],
    products: ['id', 'store_id', 'name', 'price'],
    orders: ['id', 'user_id', 'store_id', 'status', 'total'],
    orderitems: ['id', 'order_id', 'product_id', 'quantity', 'price'],
    coupons: ['id', 'code', 'discount', 'expiry'],
    payments: ['id', 'order_id', 'amount', 'status']
};

async function getSupabaseTables() {
    try {
        const { data, error } = await supabase.from('pg_catalog.pg_tables').select('*');
        if (error) throw error;
        return data.map(d => d.tablename.toLowerCase());
    } catch (err) {
        console.error('❌ Error fetching schema:', err.message);
        return [];
    }
}

function getTablesFromContent(content) {
    const tables = [];
    knownTables.forEach(tbl => {
        const regex = new RegExp(`\\b${tbl}\\b`, 'i');
        if (regex.test(content)) tables.push(tbl);
    });
    return tables;
}

async function checkRoutes() {
    const supabaseTables = await getSupabaseTables();
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    console.log('📝 تقرير فحص جميع الروتس:');
    console.log('---------------------------------------');

    for (const file of files) {
        const fullPath = path.join(routesDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');

        const hasDotenv = content.includes("require('dotenv')");
        const hasCreateClient = content.includes('createClient(');

        const usedTables = getTablesFromContent(content);

        const missingTables = usedTables.filter(t => !supabaseTables.includes(t));

        console.log(`File: ${fullPath}`);
        console.log(`- Has dotenv: ${hasDotenv}`);
        console.log(`- Has createClient: ${hasCreateClient}`);
        console.log(`- Tables used: ${usedTables.join(', ') || 'none'}`);
        if (missingTables.length > 0) {
            console.log('⚠️ Missing in DB schema:', missingTables.join(', '));
        }
        if (usedTables.length === 0) {
            console.log('⚠️ No known tables used in this route.');
        }
        console.log('---------------------------------------');
    }
}

checkRoutes();
