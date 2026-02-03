const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const fileController = require('../controllers/fileController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

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

// All routes require authentication
router.use(auth);

// Routes
router.post('/upload', upload.single('file'), fileController.uploadFile);
router.get('/', fileController.getFiles);
router.get('/search', fileController.searchFiles);
router.get('/:id/download', fileController.downloadFile);
router.delete('/:id', fileController.deleteFile);
router.patch('/:id/move', fileController.moveFile);
router.patch('/:id/rename',
    body('name').trim().notEmpty().withMessage('File name is required'),
    validate,
    fileController.renameFile
);

module.exports = router;
