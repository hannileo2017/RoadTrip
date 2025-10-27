// helpers/mailer.js
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@example.com';
const FROM_NAME = process.env.FROM_NAME || 'RoadTrip';

let transporter = null;

if (process.env.NODE_ENV === 'production') {
  // في الإنتاج: استخدم إعدادات SMTP الحقيقية
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
} else {
  // في التطوير: استخدم اختبار Nodemailer (ethereal) أو مجرد لوق
  transporter = {
    sendMail: async (opts) => {
      // لطباعة الرسالة في الكونسول بدل الإرسال
      console.log('==== Mock sendMail ====');
      console.log('To:', opts.to);
      console.log('Subject:', opts.subject);
      console.log('Text:', opts.text);
      console.log('HTML:', opts.html);
      console.log('=======================');
      return { accepted: [opts.to], messageId: 'mocked' };
    }
  };
}

/**
 * sendOTP(to, otp)
 * يرسل OTP للـ email (أو يظهر في الكونسول في DEV)
 */
async function sendOTP(to, otp) {
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject: 'رمز التحقق OTP',
    text: `رمز التحقق الخاص بك هو: ${otp}`,
    html: `<p>رمز التحقق الخاص بك هو: <b>${otp}</b></p>`
  });
  return info;
}

module.exports = { sendOTP };
