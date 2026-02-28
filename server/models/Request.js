const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    contractorName: { type: String, required: true },
    previousProgress: { type: Number, default: 0 },
    progressClaimed: { type: Number, required: true },
    photoUrl: { type: String, default: '' }, // The geotagged proof (optional)
    description: { type: String, default: '' },
    status: { type: String, default: 'Pending' }, // Pending, Approved, or Rejected
    adminComment: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);