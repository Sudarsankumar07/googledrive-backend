const File = require('../models/File');
const { uploadToS3, deleteFromS3, getSignedDownloadUrl } = require('../services/s3Service');
const { getLocalFilePath } = require('../services/localStorageService');
const fs = require('fs');
const path = require('path');

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

// Get files
exports.getFiles = async (req, res, next) => {
    try {
        const { parentId } = req.query;
        const userId = req.user._id;

        const files = await File.findByOwnerAndParent(
            userId,
            parentId === 'null' || !parentId ? null : parentId
        );

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

        // Generate signed URL (pass bucket for local storage detection)
        const downloadUrl = await getSignedDownloadUrl(file.s3Key, file.s3Bucket);

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

        // Delete from S3 or local storage
        await deleteFromS3(file.s3Key, file.s3Bucket);

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

// Serve local file (for local storage mode)
exports.serveLocalFile = async (req, res, next) => {
    try {
        const { 0: key } = req.params;
        const filePath = getLocalFilePath(key);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }

        // Get filename from key
        const fileName = path.basename(key);

        // Send file
        res.download(filePath, fileName);
    } catch (error) {
        next(error);
    }
};
