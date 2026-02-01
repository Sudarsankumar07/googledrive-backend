const multer = require('multer');

// Use memory storage for S3 upload
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
    // Block dangerous file types
    const blockedTypes = [
        'application/x-msdownload',
        'application/x-executable',
    ];

    if (blockedTypes.includes(file.mimetype)) {
        cb(new Error('This file type is not allowed'), false);
        return;
    }

    cb(null, true);
};

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter,
});

module.exports = upload;
