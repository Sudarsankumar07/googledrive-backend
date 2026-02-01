const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const folderController = require('../controllers/folderController');
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

// All routes require authentication
router.use(auth);

// Routes
router.post('/',
    body('name').trim().notEmpty().withMessage('Folder name is required'),
    validate,
    folderController.createFolder
);
router.get('/', folderController.getFolders);
router.get('/:id', folderController.getFolder);
router.get('/:id/contents', folderController.getFolderContents);
router.get('/:id/path', folderController.getFolderPath);
router.get('/:id/breadcrumb', folderController.getBreadcrumb);
router.delete('/:id', folderController.deleteFolder);
router.patch('/:id/rename',
    body('name').trim().notEmpty().withMessage('Folder name is required'),
    validate,
    folderController.renameFolder
);

module.exports = router;
