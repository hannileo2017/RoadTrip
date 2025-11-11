// helpers/logRejected.js
const { pool } = require('../db'); // تأكد من نفس ملف الاتصال بقاعدة البيانات

/**
 * يسجل محاولات الوصول المرفوضة في جدول access_rejections
 * @param {string|null} phone - رقم الهاتف إذا متوفر
 * @param {string} route - المسار الذي تم الوصول إليه
 * @param {string} reason - سبب الرفض
 */
async function logRejectedAccess(phone, route, reason) {
    try {
        await pool.query(
            `INSERT INTO access_rejections (phone, route, reason, createdat)
             VALUES ($1, $2, $3, NOW())`,
            [phone || null, route, reason]
        );
    } catch (err) {
        console.error('⚠️ Failed to log rejected access:', err.message);
    }
}

module.exports = { logRejectedAccess };
