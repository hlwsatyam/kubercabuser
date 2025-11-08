const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const { uploadImage, uploadAudio, uploadVideo, uploadDocument } = require('../config/multer');
const fs = require('fs');
const path = require('path');

// Get or create chat for user
router.post('/conversation', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    
    let chat = await Chat.findOne({ userId });
    
    if (!chat) {
      chat = new Chat({
        userId,
        userName
      });
      await chat.save();
    }
    
    res.json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Get all conversations (for admin)
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await Chat.find()
      .sort({ lastMessageTime: -1 })
      .select('userId userName lastMessage lastMessageTime unreadCount isOnline lastSeen');
    
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get messages for a conversation
router.get('/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const chat = await Chat.findOne({ userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Paginate messages
    const messages = chat.messages
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice((page - 1) * limit, page * limit);
    
    res.json({
      messages: messages.reverse(),
      totalMessages: chat.messages.length,
      hasMore: chat.messages.length > page * limit
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Send text message
router.post('/message/text', async (req, res) => {
  try {
    const { userId, sender, content } = req.body;
    
    let chat = await Chat.findOne({ userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    const newMessage = {
      sender,
      messageType: 'text',
      content,
      timestamp: new Date(),
      delivered: true,
      read: sender === 'admin' ? false : true // If admin sends, mark as unread for user
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = content.length > 50 ? content.substring(0, 50) + '...' : content;
    chat.lastMessageTime = new Date();
    
    if (sender === 'admin') {
      chat.unreadCount += 1;
    } else {
      chat.unreadCount = 0; // Reset when user sends message
    }
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send image message
router.post('/message/image', uploadImage, async (req, res) => {
  try {
    const { userId, sender } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    let chat = await Chat.findOne({ userId });
    
    if (!chat) {
      // Delete uploaded file if chat not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    const imageUrl = `/api/chat/files/images/${req.file.filename}`;
    
    const newMessage = {
      sender,
      messageType: 'image',
      content: imageUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      timestamp: new Date(),
      delivered: true,
      read: sender === 'admin' ? false : true
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = '📷 Image';
    chat.lastMessageTime = new Date();
    
    if (sender === 'admin') {
      chat.unreadCount += 1;
    } else {
      chat.unreadCount = 0;
    }
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
});

// Send audio message
router.post('/message/audio', uploadAudio, async (req, res) => {
  try {
    const { userId, sender } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }
    
    let chat = await Chat.findOne({ userId });
    
    if (!chat) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    const audioUrl = `/api/chat/files/audio/${req.file.filename}`;
    
    const newMessage = {
      sender,
      messageType: 'audio',
      content: audioUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      timestamp: new Date(),
      delivered: true,
      read: sender === 'admin' ? false : true
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = '🎵 Audio';
    chat.lastMessageTime = new Date();
    
    if (sender === 'admin') {
      chat.unreadCount += 1;
    } else {
      chat.unreadCount = 0;
    }
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
});

// Send location message
router.post('/message/location', async (req, res) => {
  try {
    const { userId, sender, lat, lng, address } = req.body;
    
    let chat = await Chat.findOne({ userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    const newMessage = {
      sender,
      messageType: 'location',
      content: `Location: ${address || `${lat}, ${lng}`}`,
      location: { lat, lng, address },
      timestamp: new Date(),
      delivered: true,
      read: sender === 'admin' ? false : true
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = '📍 Location';
    chat.lastMessageTime = new Date();
    
    if (sender === 'admin') {
      chat.unreadCount += 1;
    } else {
      chat.unreadCount = 0;
    }
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send link message
router.post('/message/link', async (req, res) => {
  try {
    const { userId, sender, url, title, description, image } = req.body;
    
    let chat = await Chat.findOne({ userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    const newMessage = {
      sender,
      messageType: 'link',
      content: url,
      linkPreview: { title, description, image },
      timestamp: new Date(),
      delivered: true,
      read: sender === 'admin' ? false : true
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = '🔗 Link';
    chat.lastMessageTime = new Date();
    
    if (sender === 'admin') {
      chat.unreadCount += 1;
    } else {
      chat.unreadCount = 0;
    }
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});




router.delete('/clear/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const chat = await Chat.findOne({ userId });
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    chat.messages = [];
    chat.lastMessage = '';
    chat.unreadCount = 0;
    chat.lastMessageTime = new Date();
    
    await chat.save();
    
    res.json({ message: 'Chat cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});






// Mark messages as read
router.put('/messages/read/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sender } = req.body; // 'admin' or 'user'
    
    const chat = await Chat.findOne({ userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Mark all messages from the other person as read
    chat.messages.forEach(message => {
      if (message.sender !== sender) {
        message.read = true;
      }
    });
    
    // Reset unread count if admin is marking as read
    if (sender === 'admin') {
      chat.unreadCount = 0;
    }
    
    await chat.save();
    
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Serve uploaded files
router.get('/files/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  const filePath = path.join(__dirname, `../uploads/${type}/${filename}`);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Update user online status
router.put('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isOnline } = req.body;
    
    const chat = await Chat.findOne({ userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    chat.isOnline = isOnline;
    chat.lastSeen = new Date();
    
    await chat.save();
    
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;