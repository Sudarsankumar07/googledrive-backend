const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
            maxlength: [50, 'First name cannot exceed 50 characters'],
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
            maxlength: [50, 'Last name cannot exceed 50 characters'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false,
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        activationToken: String,
        activationTokenExpiry: Date,
        resetPasswordToken: String,
        resetPasswordExpiry: Date,
    },
    {
        timestamps: true,
    }
);

// Index for faster queries (email index created by unique:true)
userSchema.index({ activationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate activation token
userSchema.methods.generateActivationToken = function () {
    const token = crypto.randomBytes(32).toString('hex');
    this.activationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.activationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    return token;
};

// Generate password reset token
userSchema.methods.generateResetToken = function () {
    const token = crypto.randomBytes(32).toString('hex');
    this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    this.resetPasswordExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
    return token;
};

// Get full name virtual
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

const User = mongoose.model('User', userSchema);

module.exports = User;
