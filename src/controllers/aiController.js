const aiService = require('../services/aiService');

exports.chat = async (req, res, next) => {
    try {
        const { message, context } = req.body || {};

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Message is required',
            });
        }

        const data = await aiService.chatWithFiles({
            userId: req.user._id,
            message: message.trim(),
            context: context || {},
        });

        return res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

exports.summarize = async (req, res, next) => {
    try {
        const { fileId } = req.params;
        const { force } = req.body || {};

        const data = await aiService.summarizeFile({
            userId: req.user._id,
            fileId,
            force: Boolean(force),
        });

        return res.json({
            success: true,
            data: {
                summary: data.summary,
                keyPoints: data.keyPoints,
                suggestedTags: data.tags,
                processedAt: data.processedAt,
                cached: data.cached,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.autoTag = async (req, res, next) => {
    try {
        const { fileId } = req.params;
        const { force } = req.body || {};

        const data = await aiService.autoTagFile({
            userId: req.user._id,
            fileId,
            force: Boolean(force),
        });

        return res.json({
            success: true,
            data: {
                suggestedTags: data.tags,
                processedAt: data.processedAt,
                cached: data.cached,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.search = async (req, res, next) => {
    try {
        const { query, context } = req.body || {};

        if (!query || typeof query !== 'string' || !query.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Query is required',
            });
        }

        const data = await aiService.smartSearch({
            userId: req.user._id,
            query: query.trim(),
            context: context || {},
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

exports.insights = async (req, res, next) => {
    try {
        const data = await aiService.getInsights({ userId: req.user._id });
        return res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

