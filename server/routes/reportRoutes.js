const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Report = require('../models/Report');
const User = require('../models/User');

// --- Multer config for citizen report photos ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (req, file, cb) => {
        const suffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'report-' + suffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });


// ============================================
// POST /api/reports — Create a citizen report
// ============================================
router.post('/', upload.single('photo'), async (req, res) => {
    try {
        const { requestId, citizenAnonId, comment, rating } = req.body;

        if (!requestId || !comment || !rating) {
            return res.status(400).json({ message: 'requestId, comment, and rating are required.' });
        }

        const report = new Report({
            requestId,
            citizenAnonId: citizenAnonId || 'Anonymous_User',
            photoUrl: req.file ? `/uploads/${req.file.filename}` : req.body.photoUrl || '/uploads/placeholder.jpg',
            comment,
            rating: Number(rating)
        });

        await report.save();
        res.status(201).json({ message: 'Report submitted successfully.', report });
    } catch (err) {
        console.error('Error creating report:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// GET /api/reports — Fetch all reports
// ============================================
router.get('/', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const reports = await Report.find().populate('requestId').sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        console.error('Error fetching reports:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// POST /api/reports/:id/vote — Secure unified vote
// Single vote enforcement + exclusive voting
// ============================================
router.post('/:id/vote', async (req, res) => {
    try {
        const { userId, voteType } = req.body;

        if (!userId || !voteType) {
            return res.status(400).json({ message: 'userId and voteType (true/fake) are required.' });
        }
        if (!['true', 'fake'].includes(voteType)) {
            return res.status(400).json({ message: 'voteType must be "true" or "fake".' });
        }

        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found.' });

        // --- Single Vote Enforcement ---
        const existingVote = report.voters.find(v => v.userId === userId);
        if (existingVote) {
            return res.status(409).json({
                message: 'You have already verified this report.',
                existingVoteType: existingVote.voteType
            });
        }

        // --- Record the vote ---
        report.voters.push({ userId, voteType });

        if (voteType === 'true') {
            report.trueVotes += 1;
            report.upvotes += 1;   // Backwards compat
        } else {
            report.fakeVotes += 1;
            report.downvotes += 1; // Backwards compat
        }

        // --- Auto-flag at >= 5 fake votes ---
        if (report.fakeVotes >= 5) {
            report.flagged = true;
        }

        await report.save();

        // --- Calculate report score using formula ---
        // Score = (TrueVotes / (TrueVotes + FakeVotes)) * 5
        const totalVotes = report.trueVotes + report.fakeVotes;
        const reportScore = totalVotes > 0
            ? Math.round(((report.trueVotes / totalVotes) * 5) * 10) / 10
            : 0;

        // --- Global Credibility Update ---
        // Recalculate author's credibility as avg score of ALL their reports
        if (report.citizenAnonId && report.citizenAnonId !== 'Anonymous_User') {
            await updateUserCredibility(report.citizenAnonId);
        }

        res.json({
            message: report.flagged ? 'Report flagged — Under Review.' : 'Vote recorded.',
            report,
            reportScore,
            voteType
        });
    } catch (err) {
        console.error('Error voting:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// Global credibility recalculation
// Average score of all reports by this user
// Score = (TrueVotes / (TrueVotes + FakeVotes)) * 5
// ============================================
async function updateUserCredibility(email) {
    try {
        const reports = await Report.find({ citizenAnonId: email });
        if (reports.length === 0) return;

        let totalScore = 0;
        let scoredReports = 0;

        for (const r of reports) {
            const total = r.trueVotes + r.fakeVotes;
            if (total > 0) {
                totalScore += (r.trueVotes / total) * 5;
                scoredReports++;
            }
        }

        // If no reports have votes yet, default to 5.0
        const avgScore = scoredReports > 0
            ? Math.round((totalScore / scoredReports) * 10) / 10
            : 5.0;

        // Clamp between 0 and 5 (5-point scale now)
        const clampedScore = Math.max(0, Math.min(5, avgScore));

        await User.findOneAndUpdate(
            { email },
            { $set: { credibilityScore: clampedScore } }
        );
    } catch (err) {
        console.error('Error updating user credibility:', err);
    }
}


// ============================================
// Legacy upvote/downvote — redirect to new system
// Kept for backwards compat if any old code calls them
// ============================================
router.put('/:id/upvote', async (req, res) => {
    try {
        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { $inc: { upvotes: 1, trueVotes: 1 } },
            { new: true }
        );
        if (!report) return res.status(404).json({ message: 'Report not found.' });

        if (report.citizenAnonId && report.citizenAnonId !== 'Anonymous_User') {
            await updateUserCredibility(report.citizenAnonId);
        }

        res.json({ message: 'Upvoted successfully.', report });
    } catch (err) {
        console.error('Error upvoting:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

router.put('/:id/downvote', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found.' });

        report.downvotes += 1;
        report.fakeVotes += 1;
        if (report.fakeVotes >= 5) report.flagged = true;
        await report.save();

        if (report.citizenAnonId && report.citizenAnonId !== 'Anonymous_User') {
            await updateUserCredibility(report.citizenAnonId);
        }

        res.json({
            message: report.flagged ? 'Report flagged — Under Review.' : 'Downvoted successfully.',
            report
        });
    } catch (err) {
        console.error('Error downvoting:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// GET /api/reports/credibility/:email
// Fetch a user's credibility score (5-point scale)
// ============================================
router.get('/credibility/:email', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const user = await User.findOne({ email: req.params.email });
        if (!user) return res.json({ credibilityScore: 5.0 }); // Default
        res.json({ credibilityScore: Math.round(user.credibilityScore * 10) / 10 });
    } catch (err) {
        console.error('Error fetching credibility:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


module.exports = router;
