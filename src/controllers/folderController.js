const File = require('../models/File');
const { deleteFromS3 } = require('../services/s3Service');

// Create folder
exports.createFolder = async (req, res, next) => {
    try {
        const { name, parentId } = req.body;
        const userId = req.user._id;

        // Validate parent if provided
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

        // Check if folder with same name exists in parent
        const existingFolder = await File.findOne({
            name,
            parentId: parentId || null,
            ownerId: userId,
            type: 'folder',
            isDeleted: false,
        });

        if (existingFolder) {
            return res.status(409).json({
                success: false,
                message: 'A folder with this name already exists',
            });
        }

        // Create folder
        const folder = await File.create({
            name,
            originalName: name,
            type: 'folder',
            parentId: parentId || null,
            ownerId: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Folder created successfully',
            data: folder,
        });
    } catch (error) {
        next(error);
    }
};

// Get folders
exports.getFolders = async (req, res, next) => {
    try {
        const { parentId } = req.query;
        const userId = req.user._id;

        const folders = await File.find({
            ownerId: userId,
            parentId: parentId === 'null' || !parentId ? null : parentId,
            type: 'folder',
            isDeleted: false,
        }).sort({ name: 1 });

        res.json({
            success: true,
            data: folders,
        });
    } catch (error) {
        next(error);
    }
};

// Get folder by ID
exports.getFolder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const folder = await File.findOne({
            _id: id,
            ownerId: userId,
            type: 'folder',
            isDeleted: false,
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found',
            });
        }

        res.json({
            success: true,
            data: folder,
        });
    } catch (error) {
        next(error);
    }
};

// Get folder contents (files + folders)
exports.getFolderContents = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // If id is 'root', get root contents
        const parentId = id === 'root' ? null : id;

        // Verify folder exists (if not root)
        if (parentId) {
            const folder = await File.findOne({
                _id: parentId,
                ownerId: userId,
                type: 'folder',
                isDeleted: false,
            });

            if (!folder) {
                return res.status(404).json({
                    success: false,
                    message: 'Folder not found',
                });
            }
        }

        const contents = await File.findByOwnerAndParent(userId, parentId);
        
        // Separate files and folders
        const files = contents.filter(item => item.type === 'file');
        const folders = contents.filter(item => item.type === 'folder');

        res.json({
            success: true,
            data: {
                files,
                folders
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get folder path for breadcrumb
exports.getFolderPath = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (id === 'root') {
            return res.json({
                success: true,
                data: [],
            });
        }

        const path = [];
        let currentId = id;

        while (currentId) {
            const folder = await File.findOne({
                _id: currentId,
                ownerId: userId,
                type: 'folder',
                isDeleted: false,
            });

            if (!folder) break;

            path.unshift(folder);
            currentId = folder.parentId;
        }

        res.json({
            success: true,
            data: path,
        });
    } catch (error) {
        next(error);
    }
};

// Delete folder (recursive)
exports.deleteFolder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const folder = await File.findOne({
            _id: id,
            ownerId: userId,
            type: 'folder',
            isDeleted: false,
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found',
            });
        }

        // Recursively delete all contents
        await deleteRecursive(id, userId);

        // Delete the folder itself
        await File.deleteOne({ _id: id });

        res.json({
            success: true,
            message: 'Folder and its contents deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// Helper function for recursive deletion
async function deleteRecursive(parentId, userId) {
    const children = await File.find({
        parentId,
        ownerId: userId,
        isDeleted: false,
    });

    for (const child of children) {
        if (child.type === 'folder') {
            // Recursively delete folder contents
            await deleteRecursive(child._id, userId);
        } else if (child.s3Key) {
            // Delete file from S3 or local storage
            await deleteFromS3(child.s3Key, child.s3Bucket);
        }
        // Delete from DB
        await File.deleteOne({ _id: child._id });
    }
}

// Rename folder
exports.renameFolder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const userId = req.user._id;

        const folder = await File.findOne({
            _id: id,
            ownerId: userId,
            type: 'folder',
            isDeleted: false,
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found',
            });
        }

        // Check if name already exists in same parent
        const existingFolder = await File.findOne({
            name,
            parentId: folder.parentId,
            ownerId: userId,
            type: 'folder',
            _id: { $ne: id },
            isDeleted: false,
        });

        if (existingFolder) {
            return res.status(409).json({
                success: false,
                message: 'A folder with this name already exists',
            });
        }

        folder.name = name;
        folder.originalName = name;
        await folder.save();

        res.json({
            success: true,
            message: 'Folder renamed successfully',
            data: folder,
        });
    } catch (error) {
        next(error);
    }
};

// Get breadcrumb path
exports.getBreadcrumb = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (id === 'root') {
            return res.json({
                success: true,
                data: [{ id: 'root', name: 'My Drive' }],
            });
        }

        const breadcrumb = [{ id: 'root', name: 'My Drive' }];
        let currentId = id;

        while (currentId) {
            const folder = await File.findOne({
                _id: currentId,
                ownerId: userId,
                type: 'folder',
                isDeleted: false,
            });

            if (!folder) break;

            breadcrumb.splice(1, 0, { id: folder._id.toString(), name: folder.name });
            currentId = folder.parentId;
        }

        res.json({
            success: true,
            data: breadcrumb,
        });
    } catch (error) {
        next(error);
    }
};
