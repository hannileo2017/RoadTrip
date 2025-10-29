// testRoutesSmart.js
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const routesPath = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesPath).filter(f => f.endsWith('.js'));

// optional token for protected routes
const token = process.env.TEST_TOKEN || null;

(async () => {
  console.log('🔎 Building list of GET endpoints from routers...\n');

  const tests = [];

  for (const file of files) {
    const modulePath = path.join(routesPath, file);
    let mod;
    try {
      mod = require(modulePath);
    } catch (err) {
      console.log(`⚠️ Cannot require ${file}: ${err.message}`);
      continue;
    }

    if (!mod || !mod.stack || !Array.isArray(mod.stack)) {
      console.log(`⚠️ ${file} does not export an Express Router (skipping)`);
      continue;
    }

    mod.stack.forEach(layer => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods || {});
        if (methods.includes('get')) {
          tests.push({ file, mount: '/' + file.replace('.js', ''), path: layer.route.path });
        }
      } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
        layer.handle.stack.forEach(l2 => {
          if (l2.route && l2.route.path) {
            const methods = Object.keys(l2.route.methods || {});
            if (methods.includes('get')) {
              tests.push({ file, mount: '/' + file.replace('.js', ''), path: l2.route.path });
            }
          }
        });
      }
    });
  }

  if (!tests.length) {
    console.log('⚠️ No GET endpoints discovered.');
    return;
  }

  console.log(`Found ${tests.length} GET endpoints. Testing them now against ${BASE_URL}\n`);

  for (const t of tests) {
    // compose full path (if route.path is '/', final becomes '/file' or '/file/')
    const full = BASE_URL + (t.mount === '/' ? '' : t.mount) + (t.path === '/' ? '' : t.path);
    try {
      const res = await axios.get(full, {
        timeout: 10000,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      console.log(`✅ ${t.file} -> GET ${t.path} = ${res.status} ${res.statusText}`);
    } catch (err) {
      if (err.response) {
        console.log(`⚠️ ${t.file} -> GET ${t.path} = ${err.response.status} ${err.response.statusText} | ${String(err.response.data).slice(0,120)}`);
      } else {
        console.log(`❌ ${t.file} -> GET ${t.path} = ${err.code || err.message}`);
      }
    }
  }

  console.log('\n🕒 Smart GET testing finished!');
})();
