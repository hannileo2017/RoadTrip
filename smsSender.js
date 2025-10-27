// smsSender.js
// SMS Mock: محاكاة إرسال الرسائل أثناء التطوير
// كل الرسائل ستظهر في الكونسول فقط ولا تُرسل فعليًا

function sendOTP(to, otp) {
    console.log(`[SMS MOCK] Sending OTP to ${to}: "${otp}"`);
}

module.exports = { sendOTP };
