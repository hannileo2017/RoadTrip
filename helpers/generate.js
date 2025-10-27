// helpers/response.js
module.exports = function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, data, timestamp: new Date() });
};

// helpers/generate.js
const { v4: uuidv4 } = require('uuid');

function generateRandomPassword(length = 8) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&@#$%";
    let password = letters[Math.floor(Math.random() * letters.length)];
    for (let i = 1; i < length; i++) password += chars[Math.floor(Math.random() * chars.length)];
    return password;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateUUID() {
    return uuidv4();
}

module.exports = { generateRandomPassword, generateOTP, generateUUID };
