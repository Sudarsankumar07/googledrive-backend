const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, S3_BUCKET } = require('../config/aws');

const streamToBuffer = async (readable) => {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};

const downloadFromS3 = async (s3Key) => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
        const error = new Error('AWS S3 is not configured for content extraction');
        error.statusCode = 503;
        throw error;
    }

    const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
    });

    const response = await s3Client.send(command);
    if (!response?.Body) {
        const error = new Error('Failed to read file content from S3');
        error.statusCode = 502;
        throw error;
    }

    return streamToBuffer(response.Body);
};

const isPdf = (file) => {
    const name = (file?.name || '').toLowerCase();
    const mime = (file?.mimeType || '').toLowerCase();
    return mime.includes('pdf') || name.endsWith('.pdf');
};

const isTextLike = (file) => {
    const name = (file?.name || '').toLowerCase();
    const mime = (file?.mimeType || '').toLowerCase();
    if (mime.startsWith('text/')) return true;
    if (mime.includes('json') || mime.includes('xml') || mime.includes('csv')) return true;
    if (name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.xml') || name.endsWith('.yml') || name.endsWith('.yaml')) {
        return true;
    }
    return false;
};

const extractText = async (file, { maxChars = 25000 } = {}) => {
    if (!file?.s3Key) {
        const error = new Error('File content is not available for extraction');
        error.statusCode = 400;
        throw error;
    }

    const buffer = await downloadFromS3(file.s3Key);

    if (isPdf(file)) {
        let pdfParse;
        try {
            // Optional dependency: install `pdf-parse` for better PDFs
            // eslint-disable-next-line global-require
            pdfParse = require('pdf-parse');
        } catch (e) {
            const error = new Error('PDF extraction requires the optional dependency `pdf-parse`');
            error.statusCode = 501;
            throw error;
        }

        const parsed = await pdfParse(buffer);
        const text = (parsed?.text || '').trim();
        return text.length > maxChars ? text.slice(0, maxChars) : text;
    }

    if (isTextLike(file)) {
        const text = buffer.toString('utf-8').trim();
        return text.length > maxChars ? text.slice(0, maxChars) : text;
    }

    const error = new Error('Unsupported file type for content extraction');
    error.statusCode = 415;
    throw error;
};

module.exports = {
    extractText,
};

