const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
    enum: ['user', 'admin']
  },
  messageType: {
    type: String,
    required: true,
    enum: ['text', 'image', 'audio', 'video', 'location', 'document', 'link']
  },


    role: { type: String, enum: ['driver',"user", 'admin'], default: 'user' },
  isOnline: { type: Boolean, default: false },



  content: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    default: null
  },
  fileSize: {
    type: Number,
    default: null
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String }
  },
  linkPreview: {
    title: { type: String },
    description: { type: String },
    image: { type: String }
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  },
  delivered: {
    type: Boolean,
    default: false
  }
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  userName: {
    type: String,
    required: true
  },
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageTime: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  messages: [messageSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Chat', chatSchema);