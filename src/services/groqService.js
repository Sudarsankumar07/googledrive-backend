const { GROQ_BASE_URL, GROQ_API_KEY, GROQ_MODEL, GROQ_MAX_TOKENS, GROQ_TIMEOUT_MS, GROQ_DEBUG, isGroqConfigured } = require('../config/groq');

const ensureFetchAvailable = () => {
    if (typeof fetch !== 'function') {
        const error = new Error('Global fetch() is not available in this Node runtime');
        error.statusCode = 500;
        error.expose = true;
        throw error;
    }
};

const redactForLog = (value) => {
    if (!value) return '';
    const str = String(value);
    if (str.length <= 10) return '[redacted]';
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
};

const formatFetchCause = (err) => {
    const cause = err?.cause;
    if (!cause) return '';
    const code = cause.code || cause.errno;
    const message = cause.message || '';
    const parts = [code, message].filter(Boolean);
    return parts.length ? ` (cause: ${parts.join(' - ')})` : '';
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
        error.expose = true;
        throw error;
    }

    ensureFetchAvailable();

    const url = `${GROQ_BASE_URL}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    let response;
    try {
        if (GROQ_DEBUG) {
            const msgCount = Array.isArray(messages) ? messages.length : 0;
            const approxChars = Array.isArray(messages)
                ? messages.reduce((sum, m) => sum + String(m?.content || '').length, 0)
                : 0;
            console.log('[groq] request', {
                url,
                model,
                temperature,
                max_tokens,
                messages: msgCount,
                approxChars,
                key: redactForLog(GROQ_API_KEY),
            });
        }

        response = await fetch(url, {
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
            signal: controller.signal,
        });
    } catch (err) {
        const error = new Error(`Groq request failed to send: ${err?.name === 'AbortError' ? 'timed out' : (err?.message || 'fetch failed')}${formatFetchCause(err)}`);
        error.statusCode = 502;
        error.expose = true;
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        const detail = bodyText || response.statusText || 'Unknown error';
        if (GROQ_DEBUG) {
            console.log('[groq] response', { status: response.status, statusText: response.statusText, body: detail?.slice(0, 500) });
        }
        const error = new Error(`Groq request failed (${response.status}): ${detail}`);
        error.statusCode = 502;
        error.expose = true;
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
