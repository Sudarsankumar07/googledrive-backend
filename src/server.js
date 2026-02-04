const path = require('path');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const { verifyEmailConnection } = require('./config/email');
const { getGroqConfigSummary } = require('./config/groq');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        // Verify email service (non-blocking)
        verifyEmailConnection();

        const server = app.listen(PORT, () => {
            const groq = getGroqConfigSummary();
            console.log(`Groq: ${groq.configured ? 'configured' : 'not configured'} (model=${groq.model})`);
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
        });

        server.on('error', (err) => {
            if (err?.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in googledrive-backend/.env.`);
                process.exit(1);
            }
            console.error('Server listen error:', err);
            process.exit(1);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

startServer();
