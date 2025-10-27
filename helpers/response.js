// helpers/response.js

/**
 * دالة موحدة للرد على جميع Routes
 * @param {object} res - Response object
 * @param {boolean} success - حالة النجاح
 * @param {string} message - رسالة الرد
 * @param {any} data - البيانات (اختياري)
 * @param {number} status - رمز الحالة HTTP
 */
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({
        success,
        message,
        timestamp: new Date(),
        data
    });
}

module.exports = sendResponse;
