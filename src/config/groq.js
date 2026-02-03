const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_MAX_TOKENS = Number.parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10);

const isGroqConfigured = () => Boolean(GROQ_API_KEY);

module.exports = {
    GROQ_BASE_URL,
    GROQ_API_KEY,
    GROQ_MODEL,
    GROQ_MAX_TOKENS,
    isGroqConfigured,
};

