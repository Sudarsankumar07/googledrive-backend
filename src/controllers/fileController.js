const File = require('../models/File');
const { uploadToS3, deleteFromS3, getSignedDownloadUrl } = require('../services/s3Service');

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

        // Delete from S3
        await deleteFromS3(file.s3Key);

        // Delete from DB (or soft delete)
        await File.deleteOne({ _id: id });

        res.json({
            success: true,
            message: 'File deleted successfully',
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
        }).sort({ type: -1, name: 1 });

        res.json({
            success: true,
            data: files,
        });
    } catch (error) {
        next(error);
    }
};
