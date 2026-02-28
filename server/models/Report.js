const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request',
        required: true
    },
    citizenAnonId: { type: String, default: 'Anonymous_User' },
    photoUrl: { type: String, required: true }, // The real ground condition
    comment: { type: String, required: true },
    rating: { type: Number, required: true },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    trueVotes: { type: Number, default: 0 },
    fakeVotes: { type: Number, default: 0 },
    voters: [{
        userId: { type: String, required: true },
        voteType: { type: String, enum: ['true', 'fake'], required: true }
    }],
    flagged: { type: Boolean, default: false } // Auto-flagged when fakeVotes >= 5
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);