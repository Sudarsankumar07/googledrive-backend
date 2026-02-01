require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const { verifyEmailConnection } = require('./config/email');

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Verify email service (non-blocking)
        verifyEmailConnection();

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

startServer();
