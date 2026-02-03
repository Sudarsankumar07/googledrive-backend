const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');

// Validation result middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// Validation middleware
const validateRegister = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required'),
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required'),
];

const validateLogin = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
];

const validateUpdateProfile = [
    body('firstName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('First name cannot be empty')
        .isLength({ max: 50 })
        .withMessage('First name cannot exceed 50 characters'),
    body('lastName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Last name cannot be empty')
        .isLength({ max: 50 })
        .withMessage('Last name cannot exceed 50 characters'),
];

// Routes
router.post('/register', validateRegister, validate, authController.register);
router.get('/activate/:token', authController.activateAccount);
router.post('/login', validateLogin, validate, authController.login);
router.post('/forgot-password',
    body('email').isEmail().withMessage('Please enter a valid email'),
    validate,
    authController.forgotPassword
);
router.post('/reset-password/:token',
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    validate,
    authController.resetPassword
);
router.get('/me', auth, authController.getCurrentUser);
router.patch('/me', auth, validateUpdateProfile, validate, authController.updateProfile);

module.exports = router;
