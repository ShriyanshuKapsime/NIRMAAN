/**
 * Reusable frontend helper for NIRMAAN AI endpoints (non-blocking fetch wrappers).
 * Depends on same-origin API. Extend here when adding Gemini or client-side features.
 */
(function (global) {
    const origin = global.location.origin;
    const MAX_CHARS = 12000;

    async function postAi(path, body) {
        const res = await fetch(`${origin}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        let data = {};
        try {
            data = await res.json();
        } catch (_) {
            /* ignore */
        }
        if (!res.ok) {
            const msg = data.message || res.statusText || 'Request failed';
            throw new Error(msg);
        }
        return data;
    }

    global.NirmaanAI = {
        /**
         * Rewrite citizen observation in formal, clear report style.
         * @param {string} text
         * @param {object} [context] — project snapshot, selected claim, all claims, ground-report samples (from citizen-details)
         * @returns {Promise<{ result: string }>}
         */
        improveWriting(text, context) {
            const body = {
                text: String(text || '').slice(0, MAX_CHARS),
            };
            if (context && typeof context === 'object') {
                body.context = context;
            }
            return postAi('/api/ai/improve-writing', body);
        },

        /**
         * Plain-language explanation of technical contractor/project text.
         * @param {string} text
         * @returns {Promise<{ result: string }>}
         */
        simplifyTechnical(text) {
            return postAi('/api/ai/simplify-technical', {
                text: String(text || '').slice(0, MAX_CHARS),
            });
        },
    };
})(typeof window !== 'undefined' ? window : globalThis);
