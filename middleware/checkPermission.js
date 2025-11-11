// middleware/checkPermission.js
const sql = require('../db');

// دالة middleware للتحقق من صلاحية المستخدم
// usage: checkPermission('orders.view') مثلاً
function checkPermission(permissionKey) {
  return async (req, res, next) => {
    try {
      const user = req.user; // نفترض أن JWT أو session أضاف user object
      if (!user || user.roleid === undefined) {
        return res.status(401).json({ success: false, message: 'Unauthorized: user info missing' });
      }

      // جلب صلاحيات الدور من قاعدة البيانات
      const result = await sql.query(
        `SELECT * FROM "role_permission" WHERE roleid = $1 AND permissionkey = $2 LIMIT 1`,
        [user.roleid, permissionKey]
      );

      if (!result.rows.length) {
        return res.status(403).json({ success: false, message: 'Forbidden: permission denied' });
      }

      const perm = result.rows[0];

      // نضيف بيانات الصلاحيات إلى request لتسهيل استخدام القيم لاحقاً
      req.permission = {
        canView: perm.canview,
        canEdit: perm.canedit,
        canDelete: perm.candelete,
        canAdd: perm.canadd,
      };

      // إذا كان permissionKey يتطلب view للولوج (أو تعديل حسب الحاجة)
      if (!perm.canview) {
        return res.status(403).json({ success: false, message: 'Forbidden: view permission required' });
      }

      next();
    } catch (err) {
      console.error('Error in checkPermission middleware:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}

module.exports = checkPermission;
