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

// New routes for sidebar functionality
router.get('/recent', fileController.getRecentFiles);
router.get('/starred', fileController.getStarredFiles);
router.get('/trash', fileController.getTrashFiles);
router.get('/storage-stats', fileController.getStorageStats);
router.get('/all', fileController.getAllFiles); // For analytics


router.get('/:id/content', fileController.downloadFileContent);
router.get('/:id/download', fileController.downloadFile);
router.delete('/:id', fileController.deleteFile);
router.patch('/:id/move', fileController.moveFile);
router.patch('/:id/rename',
    body('name').trim().notEmpty().withMessage('File name is required'),
    validate,
    fileController.renameFile
);

// New routes for star and trash operations
router.patch('/:id/star', fileController.toggleStar);
router.patch('/:id/restore', fileController.restoreFile);
router.delete('/:id/permanent', fileController.permanentlyDeleteFile);
router.delete('/trash/empty', fileController.emptyTrash);


module.exports = router;
