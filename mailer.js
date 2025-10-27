// routes/mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// إنشاء transporter
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,     // مثال: smtp.gmail.com
    port: process.env.MAIL_PORT,     // عادة 587 أو 465
    secure: false,                   // true إذا كان المنفذ 465
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// دالة لإرسال الإيميل
async function sendEmail(to, subject, text) {
    const mailOptions = {
        from: process.env.MAIL_USER,
        to,
        subject,
        text
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return info;
    } catch (err) {
        console.error('Error sending email:', err);
        throw err;
    }
}

module.exports = { sendEmail };
