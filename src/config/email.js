const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
const initializeSendGrid = () => {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
        console.warn('⚠️  SendGrid API key not configured');
        return false;
    }
    
    sgMail.setApiKey(apiKey);
    console.log('✅ SendGrid initialized successfully');
    return true;
};

// Verify SendGrid configuration
const verifySendGridConnection = async () => {
    try {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromAddress = process.env.EMAIL_FROM_ADDRESS;
        
        if (!apiKey) {
            console.error('❌ SENDGRID_API_KEY not configured in .env');
            return false;
        }
        
        if (!fromAddress) {
            console.error('❌ EMAIL_FROM_ADDRESS not configured in .env');
            return false;
        }
        
        console.log('✅ SendGrid configured with sender:', fromAddress);
        console.log('💡 Make sure', fromAddress, 'is verified in SendGrid dashboard');
        return true;
    } catch (error) {
        console.error('❌ SendGrid verification failed:', error.message);
        return false;
    }
};

module.exports = { initializeSendGrid, verifySendGridConnection };
