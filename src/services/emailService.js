const { createTransporter } = require('../config/email');

const sendEmail = async (to, subject, html) => {
    try {
        // Development mode: Log email content to console instead of sending
        if (process.env.NODE_ENV === 'development') {
            console.log('\n' + '='.repeat(60));
            console.log('📧 EMAIL SIMULATION (Development Mode)');
            console.log('='.repeat(60));
            console.log('📮 To:', to);
            console.log('📋 Subject:', subject);
            console.log('🔗 Email Content:');
            // Extract URL from HTML
            const resetMatch = html.match(/href="([^"]*reset-password[^"]*)"/);
            const activateMatch = html.match(/href="([^"]*activate[^"]*)"/);
            if (resetMatch) {
                console.log('\n🎯 PASSWORD RESET LINK:');
                console.log('👉', resetMatch[1]);
                console.log('\n💡 Copy this link and paste it in your browser!');
            }
            if (activateMatch) {
                console.log('\n🎯 ACTIVATION LINK:');
                console.log('👉', activateMatch[1]);
                console.log('\n💡 Copy this link and paste it in your browser!');
            }
            console.log('='.repeat(60) + '\n');
            return true;
        }

        // Production mode: Send actual email
        const transporter = createTransporter();

        await transporter.sendMail({
            from: `"CloudDrive" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });

        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        return false;
    }
};

const sendActivationEmail = async (email, token) => {
    // Validate token parameter
    if (!token || typeof token !== 'string' || token.length < 32) {
        console.error('❌ Invalid activation token provided to sendActivationEmail');
        throw new Error('Invalid activation token');
    }

    const activationUrl = `${process.env.FRONTEND_URL}/activate/${token}`;
    
    console.log('📧 Sending activation email to:', email);
    console.log('🔗 Activation URL:', activationUrl);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #3B82F6, #2563EB); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #3B82F6, #2563EB); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 Welcome to CloudDrive!</h1>
        </div>
        <div class="content">
          <h2>Activate Your Account</h2>
          <p>Thank you for registering! To complete your registration and start using CloudDrive, please activate your account by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${activationUrl}" class="btn">Activate My Account</a>
          </div>
          
          <div class="warning">
            <strong>⏰ Important:</strong> This activation link will expire in 24 hours.
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't create an account with CloudDrive, please ignore this email or contact our support team.
          </p>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            Having trouble with the button? Copy and paste this link into your browser:<br>
            <span style="word-break: break-all;">${activationUrl}</span>
          </p>
        </div>
        <div class="footer">
          <p>© 2026 CloudDrive. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    const result = await sendEmail(
        email, 
        'Activate Your CloudDrive Account', 
        html
    );
    
    if (result) {
        console.log('✅ Activation email sent successfully to:', email);
    } else {
        console.log('❌ Failed to send activation email to:', email);
    }
    
    return result;
};

const sendPasswordResetEmail = async (email, token) => {
    console.log('📧 Preparing password reset email for:', email);
    console.log('🔗 Reset token:', token.substring(0, 10) + '...');
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    console.log('🔗 Reset URL:', resetUrl);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #EF4444, #DC2626); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #3B82F6, #2563EB); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" class="btn">Reset Password</a>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request a password reset, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2026 Google Drive Clone. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    console.log('📨 Attempting to send email...');
    const result = await sendEmail(email, 'Reset Your Password - Google Drive Clone', html);
    console.log('📧 Email send result:', result);
    return result;
};

module.exports = {
    sendActivationEmail,
    sendPasswordResetEmail,
};
