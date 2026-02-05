const crypto = require('crypto');
const User = require('../models/User');
const File = require('../models/File');
const Folder = require('../models/Folder');
const { generateAccessToken } = require('../utils/helpers');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailSender');
const s3Service = require('../services/s3Service');

// Register new user
exports.register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required',
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters',
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User already exists with this email',
            });
        }

        // Create user - INACTIVE by default
        const user = new User({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            // isActive: false is the default from schema
        });

        // Generate activation token BEFORE saving
        const activationToken = user.generateActivationToken();
        
        // Save user with token
        await user.save();

        // Send activation email with proper token
        let emailSent = false;
        try {
            emailSent = await sendVerificationEmail(user.email, user.firstName, activationToken);
        } catch (emailError) {
            console.error('Failed to send activation email:', emailError);
            // Continue - user is created, they can request resend later
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful! Please check your email to activate your account.',
            data: {
                userId: user._id,
                emailSent: emailSent,
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

        console.log('🔐 Activation attempt with token:', token.substring(0, 10) + '...');
        console.log('🔐 Full token received:', token);

        // Hash the token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        console.log('🔐 Hashed token:', hashedToken.substring(0, 20) + '...');

        // First check if any user has this token (without expiry check for debugging)
        const anyUser = await User.findOne({ activationToken: hashedToken });
        console.log('🔍 User with matching token (ignoring expiry):', anyUser ? anyUser.email : 'None');

        const user = await User.findOne({
            activationToken: hashedToken,
            activationTokenExpiry: { $gt: Date.now() },
        });

        if (!user) {
            console.log('❌ No user found with matching token or token expired');
            console.log('⏰ Current time:', new Date(Date.now()).toISOString());
            if (anyUser) {
                console.log('⏰ Token expiry:', new Date(anyUser.activationTokenExpiry).toISOString());
                console.log('⚠️  Token has EXPIRED!');
            }
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired activation token. Please request a new activation email.',
            });
        }

        console.log('✅ Valid token found for user:', user.email);

        // Check if already active
        if (user.isActive) {
            console.log('⚠️  User already activated:', user.email);
            return res.json({
                success: true,
                message: 'Account already activated. You can login now.',
            });
        }

        // Activate user
        user.isActive = true;
        user.activationToken = undefined;
        user.activationTokenExpiry = undefined;
        await user.save();

        console.log('🎉 Account activated successfully:', user.email);

        res.json({
            success: true,
            message: 'Account activated successfully. You can now login.',
        });
    } catch (error) {
        console.error('❌ Activation error:', error);
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

        // Check if user has a password (Firebase migrated users might not)
        if (!user.password) {
            return res.status(400).json({
                success: false,
                message: 'This account was created with an old authentication system. Please use "Forgot Password" to set a new password.',
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
            console.log('⚠️  Login attempt with inactive account:', user.email);
            return res.status(403).json({
                success: false,
                message: 'Account not activated. Please check your email for the activation link.',
                code: 'ACCOUNT_NOT_ACTIVATED',
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
        const emailSent = await sendPasswordResetEmail(user.email, user.firstName, resetToken);

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

// Delete account
exports.deleteAccount = async (req, res, next) => {
    try {
        const { password } = req.body;
        const userId = req.user._id;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required to delete account',
            });
        }

        // Get user with password
        const user = await User.findById(userId).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password. Please try again.',
            });
        }

        // Delete all user's files from S3 and DB
        const userFiles = await File.find({ ownerId: userId });
        for (const file of userFiles) {
            if (file.s3Key) {
                try {
                    await s3Service.deleteFromS3(file.s3Key);
                } catch (error) {
                    console.error('Error deleting from S3:', error.message);
                }
            }
        }

        // Delete all files and folders from DB
        await File.deleteMany({ ownerId: userId });
        await Folder.deleteMany({ ownerId: userId });

        // Delete user account
        await User.deleteOne({ _id: userId });

        res.json({
            success: true,
            message: 'Account deleted successfully. All your files and data have been removed.',
        });
    } catch (error) {
        next(error);
    }
};
