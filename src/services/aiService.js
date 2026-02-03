const File = require('../models/File');
const { extractText } = require('./contentExtractor');
const { chatCompletion, isGroqConfigured } = require('./groqService');

const stripCodeFences = (text) => {
    if (typeof text !== 'string') return '';
    return text
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();
};

const safeJsonParse = (text) => {
    const cleaned = stripCodeFences(text);
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        return null;
    }
};

const keywordize = (input) => {
    const stop = new Set([
        'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'from', 'about', 'that', 'this', 'these', 'those',
        'my', 'your', 'our', 'their', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'as', 'at', 'by', 'into', 'over', 'under',
        'files', 'file', 'folder', 'folders', 'find', 'search', 'show', 'give', 'tell', 'summarize', 'summary'
    ]);
    return String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(w => w.length >= 3)
        .filter(w => !stop.has(w))
        .slice(0, 12);
};

const simpleSummaryFallback = (text) => {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) {
        return { summary: 'No extractable text content found for this file.', keyPoints: [], tags: [] };
    }
    const summary = cleaned.length > 400 ? `${cleaned.slice(0, 400)}…` : cleaned;
    const keyPoints = cleaned
        .split(/[.;]\s+/)
        .filter(Boolean)
        .slice(0, 5);
    const tags = keywordize(cleaned).slice(0, 5);
    return { summary, keyPoints, tags };
};

const summarizeExtractedText = async (extractedText) => {
    if (!isGroqConfigured()) {
        return simpleSummaryFallback(extractedText);
    }

    const prompt = `You are a document summarization assistant. Analyze the following document content and provide:
1. A brief summary (2-3 sentences)
2. 3-5 key points
3. 3-5 relevant tags

Document content:
${extractedText}

Respond in JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "tags": ["...", "..."]
}`;

    const completion = await chatCompletion({
        messages: [
            { role: 'system', content: 'Return only valid JSON. Do not include markdown code fences.' },
            { role: 'user', content: prompt },
        ],
        temperature: 0.2,
    });

    const parsed = safeJsonParse(completion);
    if (!parsed || typeof parsed.summary !== 'string') {
        return simpleSummaryFallback(extractedText);
    }

    return {
        summary: parsed.summary,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
};

const getFileOrThrow = async ({ userId, fileId }) => {
    const file = await File.findOne({
        _id: fileId,
        ownerId: userId,
        isDeleted: false,
        type: 'file',
    });

    if (!file) {
        const error = new Error('File not found');
        error.statusCode = 404;
        throw error;
    }

    return file;
};

const summarizeFile = async ({ userId, fileId, force = false }) => {
    const file = await getFileOrThrow({ userId, fileId });

    if (!force && file.aiSummary && file.aiProcessedAt) {
        return {
            fileId: file._id,
            summary: file.aiSummary,
            keyPoints: file.aiKeyPoints || [],
            tags: file.aiTags || [],
            processedAt: file.aiProcessedAt,
            cached: true,
        };
    }

    const extractedText = await extractText(file, { maxChars: 25000 });
    const { summary, keyPoints, tags } = await summarizeExtractedText(extractedText);

    file.aiSummary = summary || null;
    file.aiKeyPoints = Array.isArray(keyPoints) ? keyPoints.slice(0, 8) : [];
    file.aiTags = Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean).slice(0, 10) : [];
    file.aiProcessedAt = new Date();
    file.contentExtracted = extractedText || null;
    await file.save();

    return {
        fileId: file._id,
        summary: file.aiSummary,
        keyPoints: file.aiKeyPoints,
        tags: file.aiTags,
        processedAt: file.aiProcessedAt,
        cached: false,
    };
};

const autoTagFile = async ({ userId, fileId, force = false }) => {
    const result = await summarizeFile({ userId, fileId, force });
    return { fileId: result.fileId, tags: result.tags, processedAt: result.processedAt, cached: result.cached };
};

const smartSearch = async ({ userId, query, context = {} }) => {
    const keywords = keywordize(query);
    const folderFilter = context?.currentFolder ? { parentId: context.currentFolder } : {};

    if (!keywords.length) {
        return { query, keywords: [], results: [] };
    }

    const orClauses = keywords.flatMap((kw) => ([
        { name: { $regex: kw, $options: 'i' } },
        { aiSummary: { $regex: kw, $options: 'i' } },
        { aiTags: kw },
    ]));

    const files = await File.find({
        ownerId: userId,
        isDeleted: false,
        ...folderFilter,
        $or: orClauses,
    })
        .select('_id name type mimeType parentId path aiSummary aiTags')
        .limit(25);

    const scored = files.map((f) => {
        const hay = `${f.name || ''} ${(f.aiSummary || '')} ${(Array.isArray(f.aiTags) ? f.aiTags.join(' ') : '')}`.toLowerCase();
        const hits = keywords.reduce((acc, kw) => (hay.includes(kw) ? acc + 1 : acc), 0);
        const relevance = keywords.length ? hits / keywords.length : 0;
        return {
            id: f._id,
            name: f.name,
            type: f.type,
            mimeType: f.mimeType,
            parentId: f.parentId,
            path: f.path,
            relevance,
            summary: f.aiSummary || null,
            tags: f.aiTags || [],
        };
    }).sort((a, b) => b.relevance - a.relevance);

    return { query, keywords, results: scored };
};

const chatWithFiles = async ({ userId, message, context = {} }) => {
    const selectedFileIds = Array.isArray(context?.selectedFiles) ? context.selectedFiles : [];
    const folderFilter = context?.currentFolder ? { parentId: context.currentFolder } : {};

    const files = selectedFileIds.length
        ? await File.find({ ownerId: userId, isDeleted: false, type: 'file', _id: { $in: selectedFileIds } })
            .select('_id name type mimeType parentId path aiSummary aiTags')
            .limit(20)
        : await File.find({ ownerId: userId, isDeleted: false, ...folderFilter })
            .select('_id name type mimeType parentId path aiSummary aiTags')
            .sort({ type: -1, name: 1 })
            .limit(30);

    const fileList = files.map(f => ({
        id: f._id,
        name: f.name,
        type: f.type,
        parentId: f.parentId,
        path: f.path,
        summary: f.aiSummary || null,
        tags: f.aiTags || [],
    }));

    const related = await smartSearch({ userId, query: message, context });
    const relatedFiles = related.results.slice(0, 5);

    if (!isGroqConfigured()) {
        const response = relatedFiles.length
            ? `AI is not configured (missing GROQ_API_KEY). I searched your files and found ${relatedFiles.length} possible matches.`
            : 'AI is not configured (missing GROQ_API_KEY).';

        return { response, relatedFiles };
    }

    const prompt = `You are an AI assistant for CloudDrive, a cloud storage application.
You help users find, understand, and organize their files.

User's files in current context:
${JSON.stringify(fileList, null, 2)}

User's question: ${message}

Provide a helpful, concise response. If referencing files, mention them by name.`;

    const completion = await chatCompletion({
        messages: [
            { role: 'system', content: 'You are CloudDrive AI Assistant.' },
            { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 700,
    });

    return { response: completion || '', relatedFiles };
};

const getInsights = async ({ userId }) => {
    const [processedCount, totalCount] = await Promise.all([
        File.countDocuments({ ownerId: userId, isDeleted: false, type: 'file', aiProcessedAt: { $ne: null } }),
        File.countDocuments({ ownerId: userId, isDeleted: false, type: 'file' }),
    ]);

    const topTagsAgg = await File.aggregate([
        { $match: { ownerId: userId, isDeleted: false, type: 'file', aiTags: { $exists: true, $ne: [] } } },
        { $unwind: '$aiTags' },
        { $group: { _id: '$aiTags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
    ]);

    const topTags = topTagsAgg.map(t => ({ tag: t._id, count: t.count }));

    const staleCount = await File.countDocuments({
        ownerId: userId,
        isDeleted: false,
        type: 'file',
        lastAccessedAt: { $lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
    });

    return {
        totalFiles: totalCount,
        aiProcessedFiles: processedCount,
        topTags,
        staleFiles: staleCount,
        aiConfigured: isGroqConfigured(),
    };
};

module.exports = {
    summarizeFile,
    autoTagFile,
    smartSearch,
    chatWithFiles,
    getInsights,
};

