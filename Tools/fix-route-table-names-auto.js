// tools/fix-route-table-names-auto.js
const fs = require('fs');
const path = require('path');

// الجداول الموجودة فعلياً في DB
const dbTables = [
  'roles', 'role_permission', 'sessions', 'users', 'store_category', 'stores',
  'products', 'orders', 'drivers', 'order_items', 'order_tracking',
  'driver_location', 'driver_rating', 'store_rating', 'payment'
];

// خريطة أسماء الجداول في الكود → الأسماء الصحيحة في DB
const tableMap = {
  'driver_locations': 'driver_location',
  'driver_ratings': 'driver_rating',
  'role_permissions': 'role_permission',
  'storecategories': 'store_category',
  'store_ratings': 'store_rating',
  'order': 'orders',
  'areas': 'areas',
  'audittrail': 'audittrail',
  'cities': 'cities',
  'coupons': 'coupons',
  'couponsadvanced': 'couponsadvanced',
  'customers': 'customers',
  'deliveryzones': 'deliveryzones',
  'devicetokens': 'devicetokens',
  'notifications': 'notifications',
  'orderdisputes': 'orderdisputes',
  'orderhistory': 'orderhistory',
  'orderhistorydetailed': 'orderhistorydetailed',
  'supporttickets': 'supporttickets',
  'systemsettings': 'systemsettings',
  'transactions': 'transactions',
  'units': 'units'
};

const routesDir = path.join(__dirname, '../routes');

fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;

    // استبدال كل أسماء الجداول حسب tableMap
    for (const [oldName, newName] of Object.entries(tableMap)) {
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      content = content.replace(regex, newName);
    }

    if (content !== originalContent) {
      fs.copyFileSync(filePath, filePath + '.bak'); // نسخة احتياطية
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Modified: ${file} (backup created)`);
    } else {
      console.log(`⚪ No changes needed: ${file}`);
    }
  }
});
