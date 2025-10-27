// testRoutesHttp.js
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const routesPath = path.join(__dirname, 'routes');

(async () => {
  console.log('🚀 Starting simple route tests...\n');
  const files = fs.readdirSync(routesPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const route = '/' + file.replace('.js', '');
    try {
      const res = await axios.get(BASE_URL + route, { timeout: 10000 });
      console.log(`✅ ${route} - ${res.status} ${res.statusText}`);
    } catch (err) {
      if (err.response) {
        console.log(`⚠️ ${route} - ${err.response.status} ${err.response.statusText}`);
      } else {
        console.log(`❌ ${route} - ${err.code || err.message}`);
      }
    }
  }

  console.log('\n🕒 Simple route testing finished!');
})();
