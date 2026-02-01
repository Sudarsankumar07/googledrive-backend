const jwt = require('jsonwebtoken');

const generateAccessToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

module.exports = { generateAccessToken };
