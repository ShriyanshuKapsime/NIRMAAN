const express = require('express');
const { improveWriting, simplifyTechnical, textOnlyAdjudication, MAX_INPUT_CHARS } = require('../services/aiService');
const Request = require('../models/Request');
const Project = require('../models/Project');
const Report = require('../models/Report');

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

/**
 * POST /api/ai/admin-adjudicate/:requestId
 * Multi-Agent AI Adjudication — 3 distinct LLM calls:
 *   Agent A (Location Verifier) + Agent B (Scope & Sentiment) run concurrently,
 *   then Agent C (Executive Adjudicator) synthesizes both outputs.
 */
router.post('/admin-adjudicate/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        // 1. Fetch the contractor request
        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found.' });
        }

        // 2. Fetch the parent project
        const project = await Project.findById(request.projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        // 3. Fetch all citizen reports linked to this specific request
        const reports = await Report.find({ requestId: request._id }).sort({ createdAt: -1 });

        console.log(`[AI Adjudicate] Starting multi-agent pipeline for request ${requestId} (${reports.length} reports)`);

        // 4. Run the 3-agent pipeline
        const result = await textOnlyAdjudication(project, request, reports);

        // 5. Return structured result
        res.json({
            success: true,
            result,
            meta: {
                requestId: request._id,
                projectId: project._id,
                reportsAnalyzed: reports.length,
                contractorPhoto: request.photoUrl || null,
                citizenPhotos: reports.slice(0, 3).map(r => r.photoUrl).filter(Boolean)
            }
        });
    } catch (err) {
        console.error('admin-adjudicate error:', err);
        res.status(500).json({
            success: false,
            message: 'AI adjudication failed. Please try again or review manually.',
            error: err.message
        });
    }
});

module.exports = router;

