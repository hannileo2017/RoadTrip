// set-admin-password.js
const sql = require('./db'); // تأكد أن db.js موجود ويتصل بقاعدة البيانات
const crypto = require('crypto');

// توليد Salt + Hash
function generateSalt(size = 16) {
  return crypto.randomBytes(size).toString('hex');
}

function hashPasswordWithSalt(password, salt) {
  return crypto.createHash('sha256').update(salt + password, 'utf8').digest('hex');
}

async function run() {
  const username = 'admin1';
  const newPassword = '123456'; // ضع كلمة المرور الجديدة هنا
  const salt = generateSalt(8);
  const hash = hashPasswordWithSalt(newPassword, salt);
  const stored = `${salt}:${hash}`;

  try {
    const r = await sql.query(
      'UPDATE users SET password=$1 WHERE username=$2 RETURNING userid, username',
      [stored, username]
    );

    if (r.rows.length) {
      console.log('✅ Updated user', r.rows[0]);
    } else {
      console.log('⚠️ User not found. يمكنك إنشاء admin جديد لاحقاً.');
    }
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    process.exit();
  }
}

run();
