const zlib = require('zlib');
const File = require('../models/File');
const { uploadToS3 } = require('../services/s3Service');

const parseLevel = (value) => {
    const num = Number.parseInt(String(value ?? ''), 10);
    if (Number.isNaN(num)) return 6;
    return Math.min(9, Math.max(0, num));
};

exports.uploadAndCompress = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        const userId = req.user._id;
        const { parentId, format, level } = req.body || {};

        const normalizedFormat = String(format || 'gzip').toLowerCase();
        if (normalizedFormat !== 'gzip') {
            return res.status(400).json({
                success: false,
                message: 'Unsupported compression format. Only gzip is supported right now.',
            });
        }

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

        const gzipLevel = parseLevel(level);
        const compressedBuffer = await new Promise((resolve, reject) => {
            zlib.gzip(req.file.buffer, { level: gzipLevel }, (err, out) => {
                if (err) return reject(err);
                resolve(out);
            });
        });

        // Store only compressed bytes in S3; keep original metadata in DB.
        const targetName = `${req.file.originalname}.gz`;
        const { key, bucket } = await uploadToS3(
            compressedBuffer,
            targetName,
            'application/gzip',
            userId.toString()
        );

        const file = await File.create({
            // Keep user-visible name as the original filename
            name: req.file.originalname,
            originalName: req.file.originalname,
            // Store compressed size (actual storage use)
            size: compressedBuffer.length || 0,
            // Keep original mime type so UI/preview treats it like the original
            mimeType: req.file.mimetype || 'application/octet-stream',
            s3Key: key,
            s3Bucket: bucket,
            type: 'file',
            parentId: parentId || null,
            ownerId: userId,
            compression: {
                enabled: true,
                format: 'gzip',
                originalName: req.file.originalname,
                originalMimeType: req.file.mimetype || 'application/octet-stream',
                originalSize: req.file.size || 0,
            },
        });

        return res.status(201).json({
            success: true,
            message: 'File uploaded (stored compressed) successfully',
            data: file,
        });
    } catch (error) {
        next(error);
    }
};
