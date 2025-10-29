const fs = require('fs');
const path = require('path');

// قائمة الجداول الصحيحة في قاعدة البيانات (snake_case)
const tableMap = {
  users: 'users',
  orders: 'orders',
  orderitems: 'order_items',
  stores: 'stores',
  products: 'products',
  payments: 'payment',
  drivers: 'drivers',
  driverLocations: 'driver_location',
  driverRatings: 'driver_rating',
  storeRatings: 'store_rating',
  storeCategories: 'store_category',
  rolePermissions: 'role_permission',
};

// مجلد الروتس
const routesDir = path.join(__dirname, '..', 'routes');

fs.readdir(routesDir, (err, files) => {
  if (err) return console.error(err);

  files.filter(f => f.endsWith('.js')).forEach(file => {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    const backupPath = filePath + '.bak';
    fs.writeFileSync(backupPath, content, 'utf-8');

    let modified = false;

    for (const [key, val] of Object.entries(tableMap)) {
      // regex لاستبدال اسم الجدول مع مراعاة حالة الأحرف
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, val);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Modified: ${file}  (backup: ${backupPath})`);
    } else {
      console.log(`⚪ No changes needed: ${file}`);
    }
  });

  console.log('---- Done ----');
});
