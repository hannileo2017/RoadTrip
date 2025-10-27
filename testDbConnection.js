const { poolPromise } = require('./db');

(async () => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT GETDATE() AS currentTime');
        console.log('✅ Connection successful!');
        console.log('🕒 Server current date/time:', result.recordset[0].currentTime);
        pool.close();
    } catch (err) {
        console.error('❌ Connection failed:', err);
    }
})();
