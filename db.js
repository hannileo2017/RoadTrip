// db.js
const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,          // LeoDb
    password: process.env.DB_PASSWORD,  // كلمة المرور
    server: process.env.DB_SERVER,      // localhost\\SQLEXPRESS
    database: process.env.DB_NAME,      // RoadTripDB
    options: {
        encrypt: false,                 // false عند SQL Server محلي
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = sql.connect(config)
    .then(pool => {
        console.log('✅ Connected to SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('❌ Database Connection Failed!', err);
        throw err;
    });

module.exports = { sql, poolPromise };
