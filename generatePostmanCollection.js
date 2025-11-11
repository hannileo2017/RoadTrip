/**
 * generatePostmanCollection.js
 *
 * يولّد ملف Postman Collection (v2.1) بناءً على الملفات داخل مجلد routes/
 *
 * ملاحظات أمان:
 * - لا يستخدم أي أسرار من ملف .env. جميع القيم الحساسة تُركت كـ placeholders.
 * - بعد استيراد الملف في Postman، استبدل {{API_BASE_URL}} و {{authToken}} و غيرها بقيمك الحقيقية داخل Environment محلي.
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const outFile = path.join(__dirname, 'RoadTrip_API.postman_collection.json');

function safeName(s) {
  return s.replace(/[^a-zA-Z0-9_\- ]/g, '_');
}

const collection = {
  info: {
    name: "RoadTrip_API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    _postman_id: "roadtrip-collection-" + Date.now()
  },
  item: []
};

// Helper to create URL object for Postman (uses placeholders)
function createUrl(folderPath, routePath) {
  // normalize: remove leading / if folderPath already includes it
  // assumption: router is mounted at /<folderName>
  const base = "{{API_BASE_URL}}"; // set in Postman environment by user
  // assemble path: base + folderPath + routePath
  let combined = '';
  if (folderPath) {
    combined += '/' + folderPath.replace(/^\/+|\/+$/g, '');
  }
  if (routePath && routePath !== '/') {
    combined += '/' + routePath.replace(/^\/+|\/+$/g, '');
  }
  // make sure no double slashes
  combined = combined.replace(/\/+/g, '/');
  return {
    raw: base + combined,
    host: ["{{API_BASE_URL}}"], // Postman can interpret raw; keep host for clarity
    path: combined.split('/').filter(Boolean)
  };
}

fs.readdirSync(routesDir).forEach(file => {
  if (!file.endsWith('.js')) return;
  const filePath = path.join(routesDir, file);
  let router;
  try {
    router = require(filePath);
  } catch (err) {
    // If require fails (because route module expects app context), skip dynamic introspect
    // Fallback: attempt to parse file for simple route declarations (simple heuristic) — optional
    console.warn(`⚠️ Couldn't require ${file} (module may need app context). Creating placeholder folder.`);
    router = null;
  }

  const folderName = path.basename(file, '.js');
  const folder = {
    name: folderName,
    item: []
  };

  if (router && router.stack) {
    router.stack.forEach(layer => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods);
        const routePath = layer.route.path || '/';
        methods.forEach(m => {
          const method = m.toUpperCase();
          const item = {
            name: `${method} ${routePath}`,
            request: {
              method,
              header: [
                { key: "Accept", value: "application/json" },
                { key: "Content-Type", value: "application/json" },
                // Authorization header uses placeholder
                { key: "Authorization", value: "Bearer {{authToken}}", disabled: false }
              ],
              url: createUrl(folderName, routePath)
            },
            response: []
          };
          folder.item.push(item);
        });
      }
    });
  } else {
    // Fallback: add a single placeholder request for the router root
    folder.item.push({
      name: `GET / (placeholder)`,
      request: {
        method: "GET",
        header: [
          { key: "Accept", value: "application/json" },
          { key: "Content-Type", value: "application/json" },
          { key: "Authorization", value: "Bearer {{authToken}}", disabled: false }
        ],
        url: createUrl(folderName, '/')
      },
      response: []
    });
  }

  // Only add folder if it has items
  if (folder.item.length > 0) {
    collection.item.push(folder);
  }
});

// Add a small environment instructions item
collection.item.unshift({
  name: "README - Postman Environment setup",
  request: {
    method: "GET",
    header: [],
    url: {
      raw: "README",
      host: ["README"]
    }
  },
  event: [
    {
      listen: "test",
      script: {
        exec: [
          "/*",
          "Before using this collection:",
          "1) Create a Postman Environment named 'RoadTrip_API Env'.",
          "2) Add variables:",
          "   - API_BASE_URL = http://localhost:3000/api",
          "   - authToken = <your_jwt_here>",
          "   - SUPABASE_URL = https://dummy.supabase.co",
          "   - SUPABASE_SERVICE_KEY = dummy_service_key",
          "   - SUPABASE_ANON_KEY = dummy_anon_key",
          "3) Import this collection and select the environment.",
          "4) Replace authToken with a valid JWT for protected endpoints.",
          "*/"
        ]
      }
    }
  ]
});

fs.writeFileSync(outFile, JSON.stringify(collection, null, 2), 'utf8');
console.log(`✅ Postman collection generated: ${outFile}`);
console.log("🔁 الآن استورد الملف في Postman وأنشئ Environment بالمُتغيّرات الموضّحة أعلاه.");
