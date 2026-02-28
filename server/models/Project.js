const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    contractorName: { type: String, required: true },
    contractorEmail: { type: String, required: true }, // Added Email
    budget: { type: String },
    deadline: { type: Date, required: true }, // Added Deadline for "On Track/Delayed" logic
    progress: { type: Number, default: 0 },
    status: { type: String, default: 'Ongoing' }, // 'Ongoing', 'Approval Requested', or 'Completed'
    sitePhoto: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);