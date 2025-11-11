require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));

// DB Connection
let sql;
try {
    sql = require('./db');
    (async () => {
        try {
            const result = await sql.query('SELECT NOW() AS currenttime');
            console.log('✅ Connected to Supabase/Postgres');
            console.log('🕒 DB Time:', result.rows[0]?.currenttime);
        } catch (err) {
            console.warn('⚠️ DB Connection failed:', err.message);
        }
    })();
} catch (err) {
    console.warn('❌ Could not load db.js:', err.message);
}

// Make io accessible in routes
app.locals.io = io;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ===== سجل الروتس للاستخدام من /api/debug =====
app.locals.routesList = [];

// Auto-load routes with /api prefix (enhanced: record auth + methods)
const routesPath = path.join(__dirname, 'routes');
if (fs.existsSync(routesPath)) {
    fs.readdirSync(routesPath).forEach(file => {
        if (file.endsWith('.js') && !file.startsWith('_')) {
            const full = path.join(routesPath, file);
            try {
                // اقرأ محتوى الملف
                let fileContent = '';
                try { fileContent = fs.readFileSync(full, 'utf8'); } catch(e){}

                const router = require(full);
                const routePath = `/api/${file.replace('.js','')}`;
                app.use(routePath, router);
                console.log(`📡 Route loaded: ${routePath}`);

                // حاول استخراج الميثودز من router.stack
                let methods = [];
                try {
                    if (router && router.stack && Array.isArray(router.stack)) {
                        router.stack.forEach(layer => {
                            if (layer.route && layer.route.methods) {
                                methods = methods.concat(Object.keys(layer.route.methods));
                            } else if (layer.name === 'bound dispatch' && layer.method) {
                                methods.push(layer.method);
                            }
                        });
                        methods = [...new Set(methods.map(m => String(m).toUpperCase()))];
                    }
                } catch (e) {
                    methods = [];
                }

                // كحل احتياطي: تحليل نص الملف
                if (!methods.length) {
                    const found = [];
                    ['get','post','put','patch','delete'].forEach(m => {
                        const re = new RegExp(`\\.\\s*${m}\\s*\\(`, 'gi');
                        if (re.test(fileContent)) found.push(m.toUpperCase());
                    });
                    methods = found.length ? [...new Set(found)] : ['GET','POST','PUT','PATCH','DELETE'];
                }

                // اكتشاف ما إذا الملف يستدعي auth
                const authRegex = /\b(auth|authorize|authenticate|Authorization|verifyToken|require\(['"]\.?\/.*auth['"]\))/i;
                const authRequired = authRegex.test(fileContent) || (router && router.authRequired === true);

                // سجل الروت
                app.locals.routesList.push({
                    route: routePath,
                    file,
                    methods,
                    authRequired
                });

            } catch (err) {
                console.warn(`❌ Failed to load route ${file}: ${err.message}`);
            }
        }
    });
} else {
    console.warn(`⚠️ Routes folder not found: ${routesPath}`);
}

// Test route
app.get('/api/test', async (req, res) => {
    try {
        const drivers = await sql.query('SELECT COUNT(*)::int AS cnt FROM drivers');
        const stores  = await sql.query('SELECT COUNT(*)::int AS cnt FROM stores');
        const orders  = await sql.query('SELECT COUNT(*)::int AS cnt FROM orders');

        res.json({
            status: 'ok',
            connectedTo: 'Supabase/Postgres',
            time: new Date().toISOString(),
            counts: {
                drivers: drivers.rows[0].cnt,
                stores: stores.rows[0].cnt,
                orders: orders.rows[0].cnt
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    socket.on('disconnect', () => console.log('❌ Client disconnected:', socket.id));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 RoadTrip API running on http://localhost:${PORT}`));
