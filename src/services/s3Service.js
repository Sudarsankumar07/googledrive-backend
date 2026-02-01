const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, S3_BUCKET } = require('../config/aws');
const { v4: uuidv4 } = require('uuid');
const { uploadToLocal, deleteFromLocal, getLocalDownloadUrl } = require('./localStorageService');

// Check if AWS S3 is configured
const isS3Configured = () => {
    return !!(
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_S3_BUCKET
    );
};

const uploadToS3 = async (buffer, originalName, mimeType, userId) => {
    // Use local storage if S3 is not configured
    if (!isS3Configured()) {
        console.log('📁 Using local storage (S3 not configured)');
        return await uploadToLocal(buffer, originalName, mimeType, userId);
    }

    const timestamp = Date.now();
    const uuid = uuidv4();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${userId}/${timestamp}-${uuid}-${sanitizedName}`;

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
    });

    await s3Client.send(command);

    return {
        key,
        bucket: S3_BUCKET,
    };
};

const deleteFromS3 = async (key, bucket = null) => {
    // Use local storage if bucket is 'local' or S3 not configured
    if (bucket === 'local' || !isS3Configured()) {
        return await deleteFromLocal(key);
    }

    const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    await s3Client.send(command);
};

const getSignedDownloadUrl = async (key, bucket = null, expiresIn = 3600) => {
    // Use local download if bucket is 'local' or S3 not configured
    if (bucket === 'local' || !isS3Configured()) {
        return getLocalDownloadUrl(key);
    }

    const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
};

module.exports = {
    uploadToS3,
    deleteFromS3,
    getSignedDownloadUrl,
    isS3Configured,
};
