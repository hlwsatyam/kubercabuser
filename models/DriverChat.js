  const mongoose = require('mongoose');

  const messageSchema = new mongoose.Schema({
    senderId: {
      type: String,
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    senderType: {
      type: String,
      required: true,
      enum: ['user', 'admin', 'driver']
    },
    messageType: {
      type: String,
      required: true,
      enum: ['text', 'image', 'audio', 'video', 'location', 'document', 'link']
    },
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
    },
    readBy: [{
      userId: String,
      readAt: { type: Date, default: Date.now }
    }]
  });

  const groupSchema = new mongoose.Schema({
    groupId: {
      type: String,
      required: true,
      unique: true
    },
    groupName: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    adminId: {
      type: String,
      required: true
    },
    adminName: {
      type: String,
      required: true
    },
    members: [{
      memberId: String,
      memberName: String,
      memberType: {
        type: String,
        enum: ['driver', 'admin']
      },
      joinedAt: {
        type: Date,
        default: Date.now
      },
      isAdmin: {
        type: Boolean,
        default: false
      }
    }],
    isActive: {
      type: Boolean,
      default: true
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
    messages: [messageSchema]
  }, {
    timestamps: true
  });

  const chatSchema = new mongoose.Schema({
    // Personal chat between admin and driver
    chatId: {
      type: String,
      required: true,
      unique: true
    },
    participants: [{
      participantId: String,
      participantName: String,
      participantType: {
        type: String,
        enum: ['admin', 'driver']
      },
      isOnline: {
        type: Boolean,
        default: false
      },
      lastSeen: {
        type: Date,
        default: Date.now
      }
    }],
    isGroup: {
      type: Boolean,
      default: false
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
    messages: [messageSchema]
  }, {
    timestamps: true
  });

  module.exports = {
    Chat: mongoose.model('DriverChat', chatSchema),
    Group: mongoose.model('Group', groupSchema)
  };