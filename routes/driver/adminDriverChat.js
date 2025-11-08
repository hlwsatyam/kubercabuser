const express = require('express');
const router = express.Router();
const { Chat, Group } = require('../../models/DriverChat');
const Driver = require('../../models/User');
 
const fs = require('fs');
const path = require('path');

// Get all drivers for admin
router.get('/drivers', async (req, res) => {
  try {
    const drivers = await Driver.find()
      .select('name mobile')
      .sort({ isOnline: -1, createdAt: -1 });
    console.log(drivers)
    res.json(drivers);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
});

// Get conversations with drivers (personal)
router.get('/conversations/drivers', async (req, res) => {
  try {
    const conversations = await Chat.find({
      isGroup: false,
      'participants.participantType': 'driver'
    })
    .sort({ lastMessageTime: -1 });
    
    const formattedConversations = await Promise.all(
      conversations.map(async (chat) => {
        const driverParticipant = chat.participants.find(p => p.participantType === 'driver');
        const driver = await Driver.findById(driverParticipant.participantId)
          .select('name mobile vehicleType vehicleNumber isOnline isAvailable rating');
        
        return {
          chatId: chat.chatId,
          driverId: driverParticipant.participantId,
          driverName: driver?.name || 'Unknown Driver',
          mobile: driver?.mobile,
          vehicleType: driver?.vehicleType,
          vehicleNumber: driver?.vehicleNumber,
          isOnline: driver?.isOnline || false,
          isAvailable: driver?.isAvailable || false,
          rating: driver?.rating || 0,
          lastMessage: chat.lastMessage,
          lastMessageTime: chat.lastMessageTime,
          unreadCount: chat.unreadCount
        };
      })
    );
    
    res.json(formattedConversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create group
router.post('/group/create', async (req, res) => {
  try {
    const { groupName, description, driverIds } = req.body;
    
    // Generate unique group ID
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get driver details
    const drivers = await Driver.find({ _id: { $in: driverIds } })
      .select('name mobile vehicleType');
    
    const members = drivers.map(driver => ({
      memberId: driver._id.toString(),
      memberName: driver.name,
      memberType: 'driver',
      isAdmin: false
    }));
    
    // Add admin as member
    members.unshift({
      memberId: 'admin',
      memberName: 'Admin',
      memberType: 'admin',
      isAdmin: true
    });
    
    const group = new Group({
      groupId,
      groupName,
      description,
      adminId: 'admin',
      adminName: 'Admin',
      members
    });
    
    await group.save();
    
    res.json({
      message: 'Group created successfully',
      group: {
        groupId: group.groupId,
        groupName: group.groupName,
        description: group.description,
        members: group.members,
        createdAt: group.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all groups
router.get('/groups', async (req, res) => {
  try {
    const groups = await Group.find({ isActive: true })
      .sort({ lastMessageTime: -1 });
    
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add drivers to group
router.post('/group/:groupId/add-drivers', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { driverIds } = req.body;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Get driver details
    const drivers = await Driver.find({ _id: { $in: driverIds } })
      .select('name mobile vehicleType');
    
    const newMembers = drivers.map(driver => ({
      memberId: driver._id.toString(),
      memberName: driver.name,
      memberType: 'driver',
      isAdmin: false,
      joinedAt: new Date()
    }));
    
    // Add only drivers not already in group
    const existingMemberIds = group.members.map(m => m.memberId);
    const membersToAdd = newMembers.filter(member => !existingMemberIds.includes(member.memberId));
    
    group.members.push(...membersToAdd);
    await group.save();
    
    res.json({
      message: 'Drivers added to group successfully',
      addedCount: membersToAdd.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove driver from group
router.post('/group/:groupId/remove-driver', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { driverId } = req.body;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    group.members = group.members.filter(member => member.memberId !== driverId);
    await group.save();
    
    res.json({ message: 'Driver removed from group successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});




 router.get('/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
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

// Get messages for group chat (using groupId)
router.get('/messages/group/messages/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
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






// Send message to driver (personal)
router.post('/message/driver/text', async (req, res) => {
  try {
    const { driverId, content } = req.body;
    
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
      senderId: 'admin',
      senderName: 'Admin',
      senderType: 'admin',
      messageType: 'text',
      content,
      timestamp: new Date(),
      delivered: true,
      read: false
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = content.length > 50 ? content.substring(0, 50) + '...' : content;
    chat.lastMessageTime = new Date();
    chat.unreadCount += 1; // For driver
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send message to group
router.post('/message/group/text', async (req, res) => {
  try {
    const { groupId, content } = req.body;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    const newMessage = {
      senderId: 'admin',
      senderName: 'Admin',
      senderType: 'admin',
      messageType: 'text',
      content,
      timestamp: new Date(),
      delivered: true,
      read: false,
      readBy: [{
        userId: 'admin',
        readAt: new Date()
      }]
    };
    
    group.messages.push(newMessage);
    group.lastMessage = content.length > 50 ? content.substring(0, 50) + '...' : content;
    group.lastMessageTime = new Date();
    
    // Increment unread count for all members except admin
    group.unreadCount += (group.members.length - 1);
    
    await group.save();
    
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get group info
router.get('/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Get detailed driver info for members
    const driverMembers = group.members.filter(m => m.memberType === 'driver');
    const driverIds = driverMembers.map(m => m.memberId);
    
    const drivers = await Driver.find({ _id: { $in: driverIds } })
      .select('name mobile vehicleType vehicleNumber isOnline isAvailable rating');
    
    const membersWithDetails = group.members.map(member => {
      if (member.memberType === 'driver') {
        const driver = drivers.find(d => d._id.toString() === member.memberId);
        return {
          ...member.toObject(),
          vehicleType: driver?.vehicleType,
          vehicleNumber: driver?.vehicleNumber,
          isOnline: driver?.isOnline,
          isAvailable: driver?.isAvailable,
          rating: driver?.rating
        };
      }
      return member;
    });
    
    res.json({
      ...group.toObject(),
      members: membersWithDetails
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete group
router.delete('/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findOne({ groupId });
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    group.isActive = false;
    await group.save();
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;