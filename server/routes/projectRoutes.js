const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Project = require('../models/Project');
const Request = require('../models/Request');
const Report = require('../models/Report');

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extMatch = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeMatch = allowedTypes.test(file.mimetype);
    if (extMatch && mimeMatch) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});


// ============================================
// POST /api/projects — Create a new project
// ============================================
router.post('/', upload.single('sitePhoto'), async (req, res) => {
    try {
        const { name, location, contractorName, contractorEmail, budget, deadline } = req.body;

        // Validation
        if (!name || !location || !contractorName || !contractorEmail || !deadline) {
            return res.status(400).json({ message: 'Please fill in all required fields.' });
        }

        const projectData = {
            name,
            location,
            contractorName,
            contractorEmail,
            budget: budget || '',
            deadline: new Date(deadline),
            progress: 0,
            status: 'Ongoing'
        };

        // If a file was uploaded, store its path
        if (req.file) {
            projectData.sitePhoto = '/uploads/' + req.file.filename;
        }

        const project = new Project(projectData);
        await project.save();

        res.status(201).json({ message: 'Project created successfully!', project });
    } catch (err) {
        console.error('Error creating project:', err);
        if (err.message && err.message.includes('Only image files')) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error. Could not create project.' });
    }
});


// ============================================
// GET /api/projects/ratings/all
// Aggregate average citizen ratings per project
// ============================================
router.get('/ratings/all', async (req, res) => {
    try {
        const ratings = await Report.aggregate([
            {
                $lookup: {
                    from: 'requests',
                    localField: 'requestId',
                    foreignField: '_id',
                    as: 'request'
                }
            },
            { $unwind: '$request' },
            {
                $group: {
                    _id: '$request.projectId',
                    avgRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);
        // Convert to { projectId: { avg, count } } map
        const map = {};
        ratings.forEach(r => {
            map[r._id.toString()] = {
                avg: Math.round(r.avgRating * 10) / 10,
                count: r.totalReviews
            };
        });
        res.json(map);
    } catch (err) {
        console.error('Error aggregating ratings:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// GET /api/projects — Fetch projects (optional email filter)
// ============================================
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.contractorEmail) {
            filter.contractorEmail = req.query.contractorEmail;
        }
        const projects = await Project.find(filter).sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        console.error('Error fetching projects:', err);
        res.status(500).json({ message: 'Server error. Could not fetch projects.' });
    }
});


// ============================================
// GET /api/projects/:id — Fetch single project
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json(project);
    } catch (err) {
        console.error('Error fetching project:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// GET /api/projects/:id/requests
// Fetch all contractor requests for a project
// ============================================
router.get('/:id/requests', async (req, res) => {
    try {
        const requests = await Request.find({ projectId: req.params.id }).sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        console.error('Error fetching requests:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// GET /api/projects/:id/reports
// Fetch citizen reports linked to this project
// ============================================
router.get('/:id/reports', async (req, res) => {
    try {
        // First get all request IDs for this project
        const requests = await Request.find({ projectId: req.params.id }).select('_id');
        const requestIds = requests.map(r => r._id);

        // Then find all reports linked to those requests
        const reports = await Report.find({ requestId: { $in: requestIds } })
            .populate('requestId')
            .sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        console.error('Error fetching reports:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ============================================
// POST /api/projects/requests/:requestId/verify
// Admin approves or rejects a contractor request
// ============================================
router.post('/requests/:requestId/verify', async (req, res) => {
    try {
        const { status, adminComment } = req.body;

        if (!status || !['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
        }

        const request = await Request.findById(req.params.requestId);
        if (!request) return res.status(404).json({ message: 'Request not found.' });

        // Update the request
        request.status = status;
        request.adminComment = adminComment || '';
        await request.save();

        // If approved, update the parent project's progress
        if (status === 'Approved') {
            await Project.findByIdAndUpdate(request.projectId, {
                progress: request.progressClaimed,
                status: request.progressClaimed >= 100 ? 'Completed' : 'Ongoing'
            });
        }

        res.json({ message: `Request ${status.toLowerCase()} successfully.`, request });
    } catch (err) {
        console.error('Error verifying request:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


module.exports = router;
