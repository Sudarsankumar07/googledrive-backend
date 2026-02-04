const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, S3_BUCKET } = require('../config/aws');
const { v4: uuidv4 } = require('uuid');
const { Transform } = require('stream');

// Validate S3 configuration
const validateS3Config = () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
        throw new Error('AWS S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET in your environment variables.');
    }
};

const uploadToS3 = async (buffer, originalName, mimeType, userId) => {
    validateS3Config();

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

const uploadStreamToS3 = async (readableStream, originalName, mimeType, userId) => {
    validateS3Config();

    const timestamp = Date.now();
    const uuid = uuidv4();
    const sanitizedName = String(originalName || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${userId}/${timestamp}-${uuid}-${sanitizedName}`;

    let sizeBytes = 0;
    const counter = new Transform({
        transform(chunk, encoding, callback) {
            sizeBytes += chunk?.length || 0;
            callback(null, chunk);
        },
    });

    // IMPORTANT: do not attach `data` listeners to the Body stream before AWS SDK reads it.
    // Counting is done inside this Transform to avoid putting the stream into flowing mode early.
    readableStream.pipe(counter);

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: counter,
        ContentType: mimeType,
    });

    await s3Client.send(command);

    return {
        key,
        bucket: S3_BUCKET,
        sizeBytes,
    };
};

const deleteFromS3 = async (key) => {
    validateS3Config();

    const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    await s3Client.send(command);
};

const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
    validateS3Config();

    const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
};

module.exports = {
    uploadToS3,
    uploadStreamToS3,
    deleteFromS3,
    getSignedDownloadUrl,
};
