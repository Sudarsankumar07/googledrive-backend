const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'File name is required'],
            trim: true,
        },
        originalName: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            default: 0,
        },
        mimeType: {
            type: String,
            default: 'application/octet-stream',
        },
        s3Key: {
            type: String,
            unique: true,
            sparse: true, // Allow null for folders
        },
        s3Bucket: {
            type: String,
        },
        type: {
            type: String,
            enum: ['file', 'folder'],
            required: true,
        },
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'File',
            default: null,
        },
        path: {
            type: String,
            default: '/',
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        isStarred: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        lastAccessedAt: {
            type: Date,
            default: Date.now,
        },
        originalParentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'File',
            default: null,
        },

        // AI fields (optional)
        aiSummary: {
            type: String,
            default: null,
        },
        aiKeyPoints: [{
            type: String,
        }],
        aiTags: [{
            type: String,
        }],
        aiProcessedAt: {
            type: Date,
            default: null,
        },
        contentExtracted: {
            type: String,
            select: false,
            default: null,
        },
        aiMetadata: {
            documentType: { type: String, default: null },
            language: { type: String, default: null },
            sentiment: { type: String, default: null },
            keyEntities: [{ type: String }],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries (s3Key index created by unique:true)
fileSchema.index({ ownerId: 1, parentId: 1, isDeleted: 1 });
fileSchema.index({ ownerId: 1, createdAt: -1 });
fileSchema.index({ ownerId: 1, isStarred: 1, isDeleted: 1 });
fileSchema.index({ ownerId: 1, lastAccessedAt: -1, isDeleted: 1 });
fileSchema.index({ ownerId: 1, isDeleted: 1, deletedAt: -1 });

// Pre-save hook to generate path
fileSchema.pre('save', async function (next) {
    if (this.isModified('parentId') || this.isNew) {
        if (!this.parentId) {
            this.path = `/${this.name}`;
        } else {
            const parent = await this.constructor.findById(this.parentId);
            if (parent) {
                this.path = `${parent.path}/${this.name}`;
            }
        }
    }
    next();
});

// Static method to find by owner and parent
fileSchema.statics.findByOwnerAndParent = function (ownerId, parentId = null) {
    return this.find({
        ownerId,
        parentId,
        isDeleted: false,
    }).sort({ type: -1, name: 1 }); // Folders first, then alphabetical
};

const File = mongoose.model('File', fileSchema);

module.exports = File;
