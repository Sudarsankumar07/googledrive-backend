const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || '2k22aids60@kiot.ac.in';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'CloudDrive';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Send email verification link to new users
 */
const sendVerificationEmail = async (email, firstName, activationToken) => {
  const verificationLink = `${FRONTEND_URL}/activate/${activationToken}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your CloudDrive Account</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
              <!-- Header with gradient -->
              <tr>
                <td style="padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                  <table role="presentation" style="width: 100%;">
                    <tr>
                      <td align="center" style="padding: 40px 20px;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                          Welcome to CloudDrive! 🚀
                        </h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; color: #2d3748; font-size: 16px; line-height: 1.6;">
                    Hi <strong>${firstName}</strong>,
                  </p>
                  
                  <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                    Thank you for signing up! We're excited to have you on board. To get started, please verify your email address by clicking the button below:
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${verificationLink}" 
                           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                          Verify Email Address
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0; color: #718096; font-size: 14px; line-height: 1.6;">
                    Or copy and paste this link into your browser:
                  </p>
                  
                  <p style="margin: 0 0 20px; padding: 12px; background-color: #f7fafc; border-radius: 6px; color: #4a5568; font-size: 12px; word-break: break-all;">
                    ${verificationLink}
                  </p>

                  <p style="margin: 20px 0 0; color: #a0aec0; font-size: 14px; line-height: 1.6;">
                    This link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f7fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 10px; color: #718096; font-size: 13px; text-align: center;">
                    © ${new Date().getFullYear()} CloudDrive. All rights reserved.
                  </p>
                  <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                    Secure cloud storage for your files
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const textContent = `
    Welcome to CloudDrive!
    
    Hi ${firstName},
    
    Thank you for signing up! Please verify your email address by clicking the link below:
    
    ${verificationLink}
    
    This link will expire in 24 hours.
    
    If you didn't create this account, you can safely ignore this email.
    
    © ${new Date().getFullYear()} CloudDrive. All rights reserved.
  `;

  try {
    const msg = {
      to: email,
      from: {
        email: EMAIL_FROM_ADDRESS,
        name: EMAIL_FROM_NAME
      },
      subject: 'Verify Your CloudDrive Account',
      text: textContent,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`✅ Verification email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ SendGrid email error:', error.response?.body || error.message);
    
    // Fallback: Log the verification link
    console.log('\n📧 Email failed to send. Verification link:');
    console.log(verificationLink);
    console.log('\n');
    
    return false;
  }
};

/**
 * Send password reset link to users
 */
const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  const resetLink = `${FRONTEND_URL}/reset-password/${resetToken}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your CloudDrive Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 0; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px 12px 0 0;">
                  <table role="presentation" style="width: 100%;">
                    <tr>
                      <td align="center" style="padding: 40px 20px;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                          Reset Your Password 🔐
                        </h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; color: #2d3748; font-size: 16px; line-height: 1.6;">
                    Hi <strong>${firstName}</strong>,
                  </p>
                  
                  <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                    We received a request to reset your CloudDrive password. Click the button below to create a new password:
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetLink}" 
                           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(245, 87, 108, 0.3);">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0; color: #718096; font-size: 14px; line-height: 1.6;">
                    Or copy and paste this link into your browser:
                  </p>
                  
                  <p style="margin: 0 0 20px; padding: 12px; background-color: #f7fafc; border-radius: 6px; color: #4a5568; font-size: 12px; word-break: break-all;">
                    ${resetLink}
                  </p>

                  <div style="margin: 30px 0; padding: 20px; background-color: #fff5f5; border-left: 4px solid #f56565; border-radius: 6px;">
                    <p style="margin: 0; color: #742a2a; font-size: 14px; line-height: 1.6;">
                      <strong>⚠️ Security Notice:</strong><br>
                      If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                    </p>
                  </div>

                  <p style="margin: 20px 0 0; color: #a0aec0; font-size: 14px; line-height: 1.6;">
                    This link will expire in 1 hour for security reasons.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f7fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 10px; color: #718096; font-size: 13px; text-align: center;">
                    © ${new Date().getFullYear()} CloudDrive. All rights reserved.
                  </p>
                  <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                    Secure cloud storage for your files
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const textContent = `
    Reset Your CloudDrive Password
    
    Hi ${firstName},
    
    We received a request to reset your password. Click the link below to create a new password:
    
    ${resetLink}
    
    This link will expire in 1 hour.
    
    If you didn't request a password reset, please ignore this email.
    
    © ${new Date().getFullYear()} CloudDrive. All rights reserved.
  `;

  try {
    const msg = {
      to: email,
      from: {
        email: EMAIL_FROM_ADDRESS,
        name: EMAIL_FROM_NAME
      },
      subject: 'Reset Your CloudDrive Password',
      text: textContent,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`✅ Password reset email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ SendGrid email error:', error.response?.body || error.message);
    
    // Fallback: Log the reset link
    console.log('\n📧 Email failed to send. Password reset link:');
    console.log(resetLink);
    console.log('\n');
    
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
