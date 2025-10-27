// middleware/verifyToken.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.customerId = decoded.customerId || decoded.storeId || decoded.driverId;
        next();
    } catch (err) {
        res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
}

module.exports = verifyToken;
