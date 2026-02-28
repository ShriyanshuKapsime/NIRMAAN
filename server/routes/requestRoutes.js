const express = require('express');
const multer = require('multer');
const path = require('path');
const Request = require('../models/Request');
const Project = require('../models/Project');
const router = express.Router();

// --- Multer for proof-of-work photos ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (req, file, cb) => {
        const suffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'proof-' + suffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());
        cb(ok ? null : new Error('Images only'), ok);
    }
});


// ============================================
// POST /api/requests — Contractor submits progress
// ============================================
router.post('/', upload.single('proofPhoto'), async (req, res) => {
    try {
        const { projectId, progressClaimed, description } = req.body;

        if (!projectId || !progressClaimed) {
            return res.status(400).json({ message: 'Project ID and progress are required.' });
        }

        // Get the project to read current progress and contractor name
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: 'Project not found.' });

        const newRequest = new Request({
            projectId,
            contractorName: project.contractorName,
            previousProgress: project.progress,
            progressClaimed: Number(progressClaimed),
            description: description || '',
            photoUrl: req.file ? '/uploads/' + req.file.filename : '',
            status: 'Pending'
        });
        await newRequest.save();

        // Update the project status to flag it for admin
        await Project.findByIdAndUpdate(projectId, { status: 'Approval Requested' });

        res.status(201).json({ message: 'Progress submitted for approval!', request: newRequest });
    } catch (err) {
        console.error('Error creating request:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// GET /api/requests — List requests (with optional status filter)
// ============================================
router.get('/', async (req, res) => {
    try {
        const query = req.query.status ? { status: req.query.status } : {};
        const requests = await Request.find(query).populate('projectId').sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ============================================
// PUT /api/requests/:id — Update a request
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const request = await Request.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(request);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
