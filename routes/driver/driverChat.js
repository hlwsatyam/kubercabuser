const express = require('express');
const router = express.Router();
const { Chat, Group } = require('../../models/DriverChat');
const Driver = require('../../models/User');
 
const { uploadImage, uploadAudio, uploadVideo, uploadDocument } = require('../../config/multer');
const fs = require('fs');
 

// Get or create personal chat with admin
router.post('/conversation/admin', async (req, res) => {
  try {
    const driverId = req.user.id;
    const driver = await Driver.findById(driverId);
    
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    const chatId = `admin_${driverId}`;
    
    let chat = await Chat.findOne({ chatId });
    
    if (!chat) {
      chat = new Chat({
        chatId,
        isGroup: false,
        participants: [
          {
            participantId: 'admin',
            participantName: 'Admin',
            participantType: 'admin'
          },
          {
            participantId: driverId,
            participantName: driver.name,
            participantType: 'driver'
          }
        ]
      });
      await chat.save();
    }
    
    res.json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get driver's groups
router.get('/groups', async (req, res) => {
  try {
    const driverId = req.user.id;
    
    const groups = await Group.find({
      'members.memberId': driverId,
      isActive: true
    }).sort({ lastMessageTime: -1 });
    
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get group messages
router.get('/group/messages/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1,driverId, limit = 50 } = req.query;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }


    // Check if driver is member of group
    const isMember = group.members.some(member => member.memberId === driverId);
        console.log(isMember)
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }
    
    // Paginate messages
    const messages = group.messages
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice((page - 1) * limit, page * limit);
    
    res.json({
      messages: messages.reverse(),
      totalMessages: group.messages.length,
      hasMore: group.messages.length > page * limit,
      groupInfo: {
        groupId: group.groupId,
        groupName: group.groupName,
        description: group.description,
        adminId: group.adminId,
        adminName: group.adminName
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send message to admin (personal chat)
router.post('/message/admin/text', async (req, res) => {
  try {
   
    const { content, driverId   } = req.body;
    
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    const chatId = `admin_${driverId}`;
    let chat = await Chat.findOne({ chatId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    const newMessage = {
      senderId: driverId,
      senderName: driver.name,
      senderType: 'driver',
      messageType: 'text',
      content,
      timestamp: new Date(),
      delivered: true,
      read: false
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = content.length > 50 ? content.substring(0, 50) + '...' : content;
    chat.lastMessageTime = new Date();
    chat.unreadCount += 1; // For admin
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send message to group
router.post('/message/group/text', async (req, res) => {
  try {
   
    const { groupId,driverId, content } = req.body;
    
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Check if driver is member of group
    const isMember = group.members.some(member => member.memberId === driverId);
    console.log(isMember)
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }
    
    const newMessage = {
      senderId: driverId,
      senderName: driver.name,
      senderType: 'driver',
      messageType: 'text',
      content,
      timestamp: new Date(),
      delivered: true,
      read: false,
      readBy: [{
        userId: driverId,
        readAt: new Date()
      }]
    };
    
    group.messages.push(newMessage);
    group.lastMessage = content.length > 50 ? content.substring(0, 50) + '...' : content;
    group.lastMessageTime = new Date();
    
    // Increment unread count for all members except sender
    group.members.forEach(member => {
      if (member.memberId !== driverId) {
        group.unreadCount += 1;
      }
    });
    
    await group.save();
    
    res.json(newMessage);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
});

// Send image to admin
router.post('/message/admin/image', uploadImage, async (req, res) => {
  try {
    const driverId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    const driver = await Driver.findById(driverId);
    if (!driver) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Driver not found' });
    }

    const chatId = `admin_${driverId}`;
    let chat = await Chat.findOne({ chatId });
    
    if (!chat) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    const imageUrl = `/api/chat/files/images/${req.file.filename}`;
    
    const newMessage = {
      senderId: driverId,
      senderName: driver.name,
      senderType: 'driver',
      messageType: 'image',
      content: imageUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      timestamp: new Date(),
      delivered: true,
      read: false
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = '📷 Image';
    chat.lastMessageTime = new Date();
    chat.unreadCount += 1;
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
});










router.get('/messages/admin',  async (req, res) => {
  try {
    
    const { page = 1, driverId,limit = 50 } = req.query;
    
    const chatId = `admin_${driverId}`;
    const chat = await Chat.findOne({ chatId });
    
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
      hasMore: chat.messages.length > page * limit,
      chatInfo: {
        chatId: chat.chatId,
        isGroup: chat.isGroup,
        participants: chat.participants
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get messages for group chat
router.get('/messages/group/:groupId',  async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const driverId = req.user.id;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Check if driver is member of group
    const isMember = group.members.some(member => member.memberId === driverId);
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }
    
    // Paginate messages
    const messages = group.messages
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice((page - 1) * limit, page * limit);
    
    res.json({
      messages: messages.reverse(),
      totalMessages: group.messages.length,
      hasMore: group.messages.length > page * limit,
      groupInfo: {
        groupId: group.groupId,
        groupName: group.groupName,
        description: group.description,
        adminId: group.adminId,
        adminName: group.adminName
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});















// Mark messages as read in personal chat
router.put('/messages/read/admin', async (req, res) => {
  try {
    const {driverId} = req.query;
    const chatId = `admin_${driverId}`;
    
    const chat = await Chat.findOne({ chatId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Mark all admin messages as read
    chat.messages.forEach(message => {
      if (message.senderType === 'admin') {
        message.read = true;
      }
    });
    
    chat.unreadCount = 0;
    await chat.save();
    
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark group messages as read
router.put('/messages/read/group/:groupId', async (req, res) => {
  try {
    const {driverId} = req.query;
    const { groupId } = req.params;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Mark messages as read by this driver
    group.messages.forEach(message => {
      if (!message.readBy.some(read => read.userId === driverId)) {
        message.readBy.push({
          userId: driverId,
          readAt: new Date()
        });
      }
    });
    
    // Reset unread count for this driver
    group.unreadCount = Math.max(0, group.unreadCount - 1);
    
    await group.save();
    
    res.json({ message: 'Group messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update driver online status
router.put('/status/online', async (req, res) => {
  try {
    const driverId = req.user.id;
    const { isOnline } = req.body;
    
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    
    driver.isOnline = isOnline;
    await driver.save();
    
    // Update status in all chats
    await Chat.updateMany(
      { 'participants.participantId': driverId },
      { $set: { 'participants.$.isOnline': isOnline, 'participants.$.lastSeen': new Date() } }
    );
    
    res.json({ message: 'Online status updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Get all driver conversations (personal + groups)
router.get('/conversations', async (req, res) => {
  try {
    const {driverId} = req.query;
    
    // Get personal chat with admin
    let personalChat = await Chat.findOne({
      chatId: `admin_${driverId}`
    });
    
    // Get groups
    const groups = await Group.find({
      'members.memberId': driverId,
      isActive: true
    }).sort({ lastMessageTime: -1 });
    
    const conversations = [];
    
    if (personalChat) {
      conversations.push({
        type: 'personal',
        id: personalChat.chatId,
        name: 'Admin Support',
        lastMessage: personalChat.lastMessage,
        lastMessageTime: personalChat.lastMessageTime,
        unreadCount: personalChat.unreadCount,
        isOnline: personalChat.participants.find(p => p.participantType === 'admin')?.isOnline || false
      });
    }
    





    if (!personalChat) {
       const chatId = `admin_${driverId}`;
      const driver = await Driver.findById(driverId).select('name');
      const driverName = driver ? driver.name : 'Driver';

      personalChat = new Chat({
        chatId,
        participants: [
          {
            participantId: 'admin_001',  
            participantName: 'Admin',
            participantType: 'admin',
            isOnline: true
          },
          {
            participantId: driverId,
            participantName: driverName,
            participantType: 'driver',
            isOnline: false
          }
        ],
        lastMessage: 'Welcome to Admin Support!',
        lastMessageTime: new Date(),
        unreadCount: 0,
        isGroup: false,
        messages: [
          {
            senderId: 'admin_001',
            senderName: 'Admin',
            senderType: 'admin',
            messageType: 'text',
            content: 'Hello! This is your first chat with Admin.',
            timestamp: new Date(),
            read: true,
            delivered: true
          }
        ]
      });

      await personalChat.save();
    }











    groups.forEach(group => {
      conversations.push({
        type: 'group',
        id: group.groupId,
        name: group.groupName,
        lastMessage: group.lastMessage,
        lastMessageTime: group.lastMessageTime,
        unreadCount: group.unreadCount,
        isGroup: true,
        memberCount: group.members.length
      });
    });
    
    // Sort by last message time
    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
    
    res.json(conversations);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
});




module.exports = router;