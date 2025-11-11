// file: listAllRoutes.js
const fs = require('fs');
const path = require('path');
const express = require('express');

// مسار مجلد الروتس
const routesDir = path.join(__dirname, 'routes');
const app = express();

fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const routePath = path.join(routesDir, file);
    const router = require(routePath);

    // فقط إذا كان الملف فعلاً Router من Express
    if (router.stack) {
      console.log(`\n📁 ${file}`);
      router.stack.forEach(layer => {
        if (layer.route) {
          const route = layer.route;
          const methods = Object.keys(route.methods).map(m => m.toUpperCase()).join(', ');
          console.log(`   ${methods.padEnd(10)} ${route.path}`);
        }
      });
    }
  }
});
