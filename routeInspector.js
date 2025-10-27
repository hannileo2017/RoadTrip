// routeInspector.js
const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesPath).filter(f => f.endsWith('.js'));

console.log('🔎 Inspecting routes in /routes\n');

files.forEach(file => {
  const routeName = '/' + file.replace('.js', '');
  console.log(`Route file: ${file} -> mount path: ${routeName}`);

  try {
    const mod = require(path.join(routesPath, file));
    if (!mod || !mod.stack || !Array.isArray(mod.stack)) {
      console.log('  ⚠️ Module does NOT export an Express Router (likely middleware file)\n');
      return;
    }

    mod.stack.forEach(layer => {
      // normal layer with route
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase()).join(',');
        console.log(`  ${methods}  ${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
        // nested router — enumerate inner stack
        layer.handle.stack.forEach(l2 => {
          if (l2.route && l2.route.path) {
            const methods = Object.keys(l2.route.methods || {}).map(m => m.toUpperCase()).join(',');
            console.log(`  ${methods}  ${l2.route.path}  (nested)`);
          }
        });
      } else {
        // middleware or unknown layer
        console.log(`  [middleware] ${layer.name}`);
      }
    });
    console.log('');
  } catch (err) {
    console.log(`  ❌ Error requiring file: ${err.message}\n`);
  }
});
