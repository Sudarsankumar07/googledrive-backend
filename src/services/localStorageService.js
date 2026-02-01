const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Local uploads directory
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
const ensureUploadsDir = async (userId) => {
    const userDir = path.join(UPLOADS_DIR, userId);
    try {
        await fs.mkdir(userDir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
    return userDir;
};

const uploadToLocal = async (buffer, originalName, mimeType, userId) => {
    const userDir = await ensureUploadsDir(userId);
    
    const timestamp = Date.now();
    const uuid = uuidv4();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${uuid}-${sanitizedName}`;
    const filePath = path.join(userDir, fileName);
    
    await fs.writeFile(filePath, buffer);
    
    return {
        key: `${userId}/${fileName}`,
        bucket: 'local',
    };
};

const deleteFromLocal = async (key) => {
    const filePath = path.join(UPLOADS_DIR, key);
    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
};

const getLocalFilePath = (key) => {
    return path.join(UPLOADS_DIR, key);
};

const getLocalDownloadUrl = (key, req) => {
    // Return a local API endpoint for downloading
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    return `${baseUrl}/api/files/local/${encodeURIComponent(key)}`;
};

module.exports = {
    uploadToLocal,
    deleteFromLocal,
    getLocalFilePath,
    getLocalDownloadUrl,
    UPLOADS_DIR,
};
