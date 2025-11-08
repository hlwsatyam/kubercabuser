const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true // createdAt और updatedAt automatically
});

module.exports = mongoose.model('Message', messageSchema);