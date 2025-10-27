// routes/verifyToken.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

function verifyToken(req, res, next) {
  // قراءة الهيدر بطريقة مرنة
  const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization || req.get && req.get('Authorization'));
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  // نتوقع "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({ success: false, message: 'Invalid token format' });
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.customerId = decoded.customerId; // نضع الـ id لاستخدامه في الـ routes
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

module.exports = { verifyToken }; // بدل module.exports = verifyToken;
