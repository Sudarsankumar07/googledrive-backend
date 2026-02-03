const crypto = require('crypto');
const User = require('../models/User');
const { generateAccessToken } = require('../utils/helpers');
const { sendActivationEmail, sendPasswordResetEmail } = require('../services/emailService');

// Register new user
exports.register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User already exists with this email',
            });
        }

        // Create user - auto-activated for development
        const user = new User({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            isActive: true, // Auto-activate for easier development
        });

        await user.save();

        // Optional: Still try to send welcome email (non-blocking)
        try {
            await sendActivationEmail(user.email, 'welcome');
        } catch (emailError) {
            // Email failed but user is registered successfully
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful! You can now login.',
            data: {
                userId: user._id,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Activate account
exports.activateAccount = async (req, res, next) => {
    try {
        const { token } = req.params;

        // Hash the token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            activationToken: hashedToken,
            activationTokenExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired activation token',
            });
        }

        // Activate user
        user.isActive = true;
        user.activationToken = undefined;
        user.activationTokenExpiry = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Account activated successfully. You can now login.',
        });
    } catch (error) {
        next(error);
    }
};

// Login
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user with password
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Check if active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account not activated. Please check your email.',
            });
        }

        // Generate token
        const token = generateAccessToken(user._id);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({
                success: true,
                message: 'If an account exists with this email, a password reset link will be sent.',
            });
        }

        // Generate reset token
        const resetToken = user.generateResetToken();
        await user.save();

        // Send email
        const emailSent = await sendPasswordResetEmail(user.email, resetToken);

        res.json({
            success: true,
            message: 'If an account exists with this email, a password reset link will be sent.',
        });
    } catch (error) {
        next(error);
    }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        // Hash the token
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token',
            });
        }

        // Update password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.',
        });
    } catch (error) {
        next(error);
    }
};

// Get current user
exports.getCurrentUser = async (req, res, next) => {
    try {
        res.json({
            success: true,
            data: {
                id: req.user._id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                createdAt: req.user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Update current user profile
exports.updateProfile = async (req, res, next) => {
    try {
        const { firstName, lastName } = req.body;

        if (firstName !== undefined) {
            req.user.firstName = firstName;
        }
        if (lastName !== undefined) {
            req.user.lastName = lastName;
        }

        await req.user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: req.user._id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                createdAt: req.user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};
