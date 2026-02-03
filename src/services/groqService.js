const { GROQ_BASE_URL, GROQ_API_KEY, GROQ_MODEL, GROQ_MAX_TOKENS, isGroqConfigured } = require('../config/groq');

const ensureFetchAvailable = () => {
    if (typeof fetch !== 'function') {
        const error = new Error('Global fetch() is not available in this Node runtime');
        error.statusCode = 500;
        throw error;
    }
};

const chatCompletion = async ({
    messages,
    model = GROQ_MODEL,
    temperature = 0.2,
    max_tokens = GROQ_MAX_TOKENS,
}) => {
    if (!isGroqConfigured()) {
        const error = new Error('GROQ_API_KEY is not configured');
        error.statusCode = 503;
        throw error;
    }

    ensureFetchAvailable();

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens,
        }),
    });

    if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        const error = new Error(`Groq request failed (${response.status}): ${bodyText || response.statusText}`);
        error.statusCode = 502;
        throw error;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
};

module.exports = {
    chatCompletion,
    isGroqConfigured,
};

