const express = require('express');
const { improveWriting, simplifyTechnical, MAX_INPUT_CHARS } = require('../services/aiService');

const router = express.Router();

/**
 * POST /api/ai/improve-writing
 * Body: { text: string, context?: object } — context = project, selected claim, all claims, sample reports
 */
router.post('/improve-writing', async (req, res) => {
    try {
        const { text, context } = req.body;
        if (typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ message: 'Text is required.' });
        }
        const ctx = context !== undefined && context !== null && typeof context === 'object' && !Array.isArray(context)
            ? context
            : undefined;
        const result = await improveWriting(text.slice(0, MAX_INPUT_CHARS), ctx);
        res.json({ result });
    } catch (err) {
        console.error('improve-writing:', err.message);
        res.status(500).json({ message: 'Unable to improve text right now.' });
    }
});

/**
 * POST /api/ai/simplify-technical
 * Body: { text: string }
 */
router.post('/simplify-technical', async (req, res) => {
    try {
        const { text } = req.body;
        if (typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ message: 'Text is required.' });
        }
        const result = await simplifyTechnical(text.slice(0, MAX_INPUT_CHARS));
        res.json({ result });
    } catch (err) {
        console.error('simplify-technical:', err.message);
        res.status(500).json({ message: 'Unable to simplify content right now.' });
    }
});

module.exports = router;
