const GROQ_BASE_URL = String(process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_MAX_TOKENS = Number.parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10);
const GROQ_TIMEOUT_MS = Number.parseInt(process.env.GROQ_TIMEOUT_MS || '20000', 10);
const GROQ_DEBUG = process.env.GROQ_DEBUG === 'true';

const isGroqConfigured = () => Boolean(String(GROQ_API_KEY || '').trim());

const getGroqConfigSummary = () => ({
    configured: isGroqConfigured(),
    baseUrl: GROQ_BASE_URL,
    model: GROQ_MODEL,
    maxTokens: GROQ_MAX_TOKENS,
    timeoutMs: GROQ_TIMEOUT_MS,
    apiKeyLength: String(GROQ_API_KEY || '').length,
    debug: GROQ_DEBUG,
});

module.exports = {
    GROQ_BASE_URL,
    GROQ_API_KEY,
    GROQ_MODEL,
    GROQ_MAX_TOKENS,
    GROQ_TIMEOUT_MS,
    GROQ_DEBUG,
    isGroqConfigured,
    getGroqConfigSummary,
};
