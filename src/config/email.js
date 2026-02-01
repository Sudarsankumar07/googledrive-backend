const nodemailer = require('nodemailer');

const createTransporter = () => {
    // Debug: Log email config (remove in production)
    console.log('📧 Email Config:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        passLength: process.env.EMAIL_PASSWORD?.length || 0,
        passPrefix: process.env.EMAIL_PASSWORD?.substring(0, 10) || 'N/A',
    });

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });
};

// Test email connection
const verifyEmailConnection = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        console.log('✅ Email service connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Email service connection failed:', error.message);
        console.log('💡 To fix: Check your Brevo SMTP key at https://app.brevo.com/settings/keys/smtp');
        return false;
    }
};

module.exports = { createTransporter, verifyEmailConnection };
