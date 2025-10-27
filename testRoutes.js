require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const routesPath = path.join(__dirname, 'routes');

(async () => {
    console.log('🚀 Starting route tests...\n');

    const files = fs.readdirSync(routesPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
        const routeName = '/' + file.replace('.js', '');
        try {
            const res = await axios.get(BASE_URL + routeName);
            console.log(`✅ ${routeName} - Status: ${res.status}`);
        } catch (err) {
            if (err.response) {
                console.log(`⚠️ ${routeName} - Status: ${err.response.status}`);
            } else {
                console.log(`❌ ${routeName} - Error: ${err.message}`);
            }
        }
    }

    console.log('\n🕒 Route testing finished!');
})();
