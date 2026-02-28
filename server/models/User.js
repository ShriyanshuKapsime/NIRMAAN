const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6
    },
    role: {
        type: String,
        enum: ['admin', 'contractor', 'citizen'],
        required: [true, 'Role is required']
    },
    credibilityScore: {
        type: Number,
        default: 5.0,
        min: 0,
        max: 10
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
