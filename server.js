const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected successfully!'))
    .catch(err => console.log('❌ MongoDB Connection Error: ', err));

// Basic test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is running!' });
});

// Auth routes
app.use('/api/auth', require('./server/routes/auth'));

// Project routes
app.use('/api/projects', require('./server/routes/projectRoutes'));

// Request routes
app.use('/api/requests', require('./server/routes/requestRoutes'));

// Report routes
app.use('/api/reports', require('./server/routes/reportRoutes'));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});