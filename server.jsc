const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const connectDB = require('./config/database.js');
const path = require('path');
dotenv.config();
connectDB();
 
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Morgan setup — log every request
app.use(morgan(':method :url :status :response-time ms - :date[iso]'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
 
const fs = require('fs');
const uploadDirs = ['uploads/images', 'uploads/audio', 'uploads/videos', 'uploads/documents'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

  
require('./config/firebaseApps.js');

 
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/messages', require('./routes/messages.js'));
app.use('/api/banners', require('./routes/banners.js'));
app.use('/api/packages', require('./routes/packages.js'));
app.use('/api/chat', require('./routes/chat.js'));
app.use('/api/token', require('./routes/token.js'));


app.use('/api/driver/chat', require('./routes/driver/driverChat.js'));
app.use('/api/admin', require('./routes/driver/adminDriverChat.js'));

// Health route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'KuberCab API is running!',
    timestamp: new Date().toISOString()
  });
});
 
// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// Handle unhandled routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚗 KuberCab Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});