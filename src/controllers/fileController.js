const File = require('../models/File');
const { uploadToS3, deleteFromS3, getSignedDownloadUrl } = require('../services/s3Service');
const aiService = require('../services/aiService');

// Upload file
exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        const { parentId } = req.body;
        const userId = req.user._id;

        // Validate parent folder if provided
        if (parentId) {
            const parentFolder = await File.findOne({
                _id: parentId,
                ownerId: userId,
                type: 'folder',
                isDeleted: false,
            });

            if (!parentFolder) {
                return res.status(404).json({
                    success: false,
                    message: 'Parent folder not found',
                });
            }
        }

        // Upload to S3
        const { key, bucket } = await uploadToS3(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            userId.toString()
        );

        // Create file record
        const file = await File.create({
            name: req.file.originalname,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
            s3Key: key,
            s3Bucket: bucket,
            type: 'file',
            parentId: parentId || null,
            ownerId: userId,
        });

        // Optional: Auto-summarize/tag on upload (non-blocking)
        if (process.env.AI_AUTO_SUMMARY_ON_UPLOAD === 'true') {
            setImmediate(() => {
                aiService.summarizeFile({ userId, fileId: file._id })
                    .catch((err) => console.error('AI auto-summary failed:', err.message || err));
            });
        }

        res.status(201).json({
            success: true,
            message: 'File uploaded successfully',
            data: file,
        });
    } catch (error) {
        next(error);
    }
};

// Helper function to calculate folder size recursively
const calculateFolderSize = async (folderId, userId) => {
    const contents = await File.find({
        parentId: folderId,
        ownerId: userId,
        isDeleted: false
    });

    let totalSize = 0;

    for (const item of contents) {
        if (item.type === 'file') {
            totalSize += item.size || 0;
        } else if (item.type === 'folder') {
            // Recursively calculate subfolder sizes
            totalSize += await calculateFolderSize(item._id, userId);
        }
    }

    return totalSize;
};

// Get files
exports.getFiles = async (req, res, next) => {
    try {
        const { parentId } = req.query;
        const userId = req.user._id;

        // Only get files, not folders
        const files = await File.find({
            ownerId: userId,
            parentId: parentId === 'null' || !parentId ? null : parentId,
            type: 'file',
            isDeleted: false,
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: files,
        });
    } catch (error) {
        next(error);
    }
};

// Download file
exports.downloadFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const file = await File.findOne({
            _id: id,
            ownerId: userId,
            type: 'file',
            isDeleted: false,
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }

        // Generate signed URL for S3
        const downloadUrl = await getSignedDownloadUrl(file.s3Key);

        res.json({
            success: true,
            data: {
                downloadUrl,
                fileName: file.originalName,
                expiresIn: 3600,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Delete file
exports.deleteFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const file = await File.findOne({
            _id: id,
            ownerId: userId,
            type: 'file',
            isDeleted: false,
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }

        // Soft delete - move to trash
        file.isDeleted = true;
        file.deletedAt = new Date();
        file.originalParentId = file.parentId; // Store for restore
        await file.save();

        res.json({
            success: true,
            message: 'File moved to trash',
        });
    } catch (error) {
        next(error);
    }
};

// Move file
exports.moveFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newParentId } = req.body;
        const userId = req.user._id;

        const file = await File.findOne({
            _id: id,
            ownerId: userId,
            isDeleted: false,
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }

        // Validate new parent if provided
        if (newParentId) {
            const newParent = await File.findOne({
                _id: newParentId,
                ownerId: userId,
                type: 'folder',
                isDeleted: false,
            });

            if (!newParent) {
                return res.status(404).json({
                    success: false,
                    message: 'Target folder not found',
                });
            }
        }

        file.parentId = newParentId || null;
        await file.save();

        res.json({
            success: true,
            message: 'File moved successfully',
            data: file,
        });
    } catch (error) {
        next(error);
    }
};

// Rename file
exports.renameFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const userId = req.user._id;

        const file = await File.findOne({
            _id: id,
            ownerId: userId,
            type: 'file',
            isDeleted: false,
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }

        // Check if file with same name exists in same parent
        const existingFile = await File.findOne({
            name,
            parentId: file.parentId,
            ownerId: userId,
            type: 'file',
            _id: { $ne: id },
            isDeleted: false,
        });

        if (existingFile) {
            return res.status(409).json({
                success: false,
                message: 'A file with this name already exists in this folder',
            });
        }

        file.name = name;
        await file.save();

        res.json({
            success: true,
            message: 'File renamed successfully',
            data: file,
        });
    } catch (error) {
        next(error);
    }
};

// Search files and folders
exports.searchFiles = async (req, res, next) => {
    try {
        const { query } = req.query;
        const userId = req.user._id;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required',
            });
        }

        const files = await File.find({
            ownerId: userId,
            isDeleted: false,
            name: { $regex: query, $options: 'i' },
        })
            .select('_id name type mimeType parentId path size createdAt')
            .sort({ type: -1, name: 1 });

        res.json({
            success: true,
            data: files,
        });
    } catch (error) {
        next(error);
    }
};

// Get Recent Files
exports.getRecentFiles = async (req, res, next) => {
    try {
        const { limit = 50 } = req.query;
        const userId = req.user._id;

        const files = await File.find({
            ownerId: userId,
            type: 'file',
            isDeleted: false
        })
            .sort({ lastAccessedAt: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: files,
            count: files.length
        });
    } catch (error) {
        next(error);
    }
};

// Get Starred Files
exports.getStarredFiles = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const files = await File.find({
            ownerId: userId,
            isStarred: true,
            isDeleted: false
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: files,
            count: files.length
        });
    } catch (error) {
        next(error);
    }
};

// Toggle Star
exports.toggleStar = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isStarred } = req.body;
        const userId = req.user._id;

        const file = await File.findOne({
            _id: id,
            ownerId: userId,
            isDeleted: false
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        file.isStarred = isStarred;
        await file.save();

        res.json({
            success: true,
            message: isStarred ? 'File starred' : 'File unstarred',
            data: file
        });
    } catch (error) {
        next(error);
    }
};

// Get Trash Files
exports.getTrashFiles = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const files = await File.find({
            ownerId: userId,
            isDeleted: true
        }).sort({ deletedAt: -1 });

        res.json({
            success: true,
            data: files,
            count: files.length
        });
    } catch (error) {
        next(error);
    }
};

// Restore File from Trash
exports.restoreFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const file = await File.findOne({
            _id: id,
            ownerId: userId,
            isDeleted: true
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found in trash'
            });
        }

        // Check if original parent still exists and is not deleted
        if (file.originalParentId) {
            const parentExists = await File.findOne({
                _id: file.originalParentId,
                ownerId: userId,
                isDeleted: false
            });

            if (!parentExists) {
                // Restore to root if parent is deleted
                file.parentId = null;
            } else {
                file.parentId = file.originalParentId;
            }
        }

        file.isDeleted = false;
        file.deletedAt = null;
        file.originalParentId = null;
        await file.save();

        res.json({
            success: true,
            message: 'File restored successfully',
            data: file
        });
    } catch (error) {
        next(error);
    }
};

// Permanently Delete File
exports.permanentlyDeleteFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const file = await File.findOne({
            _id: id,
            ownerId: userId,
            isDeleted: true,
            type: 'file'
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found in trash'
            });
        }

        // Delete from S3
        await deleteFromS3(file.s3Key);

        // Delete from DB
        await File.deleteOne({ _id: id });

        res.json({
            success: true,
            message: 'File permanently deleted'
        });
    } catch (error) {
        next(error);
    }
};

// Empty Trash
exports.emptyTrash = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Find all deleted files
        const deletedFiles = await File.find({
            ownerId: userId,
            isDeleted: true,
            type: 'file'
        });

        // Delete each from S3
        for (const file of deletedFiles) {
            if (file.s3Key) {
                try {
                    await deleteFromS3(file.s3Key);
                } catch (error) {
                    console.error(`Failed to delete ${file.s3Key} from S3:`, error);
                }
            }
        }

        // Delete all from DB
        const result = await File.deleteMany({
            ownerId: userId,
            isDeleted: true
        });

        res.json({
            success: true,
            message: 'Trash emptied successfully',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        next(error);
    }
};

// Get Storage Statistics
exports.getStorageStats = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Get all files (including trash) for the user
        const files = await File.find({
            ownerId: userId,
            type: 'file'
        });

        // Calculate total storage used
        let totalUsed = 0;
        let activeStorage = 0;
        let trashStorage = 0;
        let fileCount = 0;
        let trashCount = 0;

        files.forEach(file => {
            const size = file.size || 0;
            totalUsed += size;

            if (file.isDeleted) {
                trashStorage += size;
                trashCount++;
            } else {
                activeStorage += size;
                fileCount++;
            }
        });

        // Storage limit (5GB)
        const storageLimit = 5 * 1024 * 1024 * 1024; // 5GB in bytes
        const usagePercentage = (totalUsed / storageLimit) * 100;

        res.json({
            success: true,
            data: {
                totalUsed,
                activeStorage,
                trashStorage,
                storageLimit,
                usagePercentage: Math.min(usagePercentage, 100),
                fileCount,
                trashCount
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get all user files (for analytics)
exports.getAllFiles = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Fetch all files owned by user (excluding folders and deleted files)
        const files = await File.find({
            ownerId: userId,
            type: 'file',
            isDeleted: false
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: files,
            count: files.length
        });
    } catch (error) {
        next(error);
    }
};

