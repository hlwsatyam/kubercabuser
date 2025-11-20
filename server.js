 

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1000 * 1024 * 1024 // 10MB limit
  }
});

// MongoDB connection
const mongoURL = "mongodb+srv://HeySatyam:20172522Satyam@cluster0.xqoozjj.mongodb.net/chat_app_for_user?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "chat_app_for_user";
let db;

// Connect to MongoDB
MongoClient.connect(mongoURL, { useUnifiedTopology: true })
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
    initializeAdmin();
    initializeGroups();
  })
  .catch(error => console.error('MongoDB connection error:', error));

// Initialize admin user
async function initializeAdmin() {
  const usersCollection = db.collection('users');
  const adminExists = await usersCollection.findOne({ username: 'kubercab', role: 'admin' });
  
  if (!adminExists) {
    await usersCollection.insertOne({
      username: 'kubercab',
      password: 'kubercab@12345',
      role: 'admin', 
      createdAt: new Date(),
      isOnline: false
    });
    console.log('Admin user created');
  }
}

// Initialize groups collections
async function initializeGroups() {
  const groupsCollection = db.collection('groups');
  const groupMembersCollection = db.collection('group_members');
  
  // Create indexes for better performance
  await groupsCollection.createIndex({ createdAt: -1 });
  await groupMembersCollection.createIndex({ groupId: 1 });
  await groupMembersCollection.createIndex({ userId: 1 });
  console.log('Groups collections initialized');
}

// Firebase configuration
const connectDB = require('./config/database.js');
const { firebaseKuberCab } = require('./config/firebaseApps.js');
connectDB();

// Routes
app.use('/api/messages', require('./routes/messages.js'));
app.use('/api/banners', require('./routes/banners.js'));
app.use('/api/packages', require('./routes/packages.js'));

app.use('/api/token', (req, res, next) => {
  req.db = db;
  next();
}, require('./routes/token.js'));

// Store online users
const onlineUsers = new Map();







app.get('/api/app/version', (req, res) => {
  res.json({
    minVersion: 6, // Minimum required version
    latestVersion: 7, // Latest available version
    forceUpdate: true, // Whether update is mandatory
    message: "Critical security update available. Please update to continue using the app.",
    updateUrl: {
      android: "https://play.google.com/store/apps/details?id=com.kubercabdriver",
      ios: "https://apps.apple.com/app/idYOUR_APP_ID"
    }
  });
});










// File upload endpoint
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      fileUrl: fileUrl,
      fileName: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Get all users for admin (for group creation)
app.get('/api/users', async (req, res) => {
  try {
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({
      role: 'customer'
    }).project({
      username: 1,
      name: 1,
      phone: 1,
      isOnline: 1,
      createdAt: 1
    }).toArray();

    res.json({
      success: true,
      users: users.map(user => ({
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        phone: user.phone,
        isOnline: user.isOnline,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Get user groups
app.get('/api/user-groups/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const groupMembersCollection = db.collection('group_members');
    const groupsCollection = db.collection('groups');

    const userGroups = await groupMembersCollection.find({
      userId: userId
    }).toArray();

    const groupIds = userGroups.map(ug => ug.groupId);

    const groups = await groupsCollection.find({
      _id: { $in: groupIds.map(id => new ObjectId(id)) }
    }).toArray();

    res.json({
      success: true,
      groups: groups.map(group => ({
        id: group._id.toString(),
        name: group.name,
        description: group.description,
        memberCount: group.memberCount,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      }))
    });
  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user groups' });
  }
});

// FCM Message Function for individual chats
async function sendFCMMessage(messageData) {
  try {
    const { conversationId, messageType, message, senderId } = messageData;
    const usersCollection = db.collection('users');
    const conversationsCollection = db.collection('conversations');

    // Get conversation details
    const conversation = await conversationsCollection.findOne({ 
      _id: new ObjectId(conversationId) 
    });

    if (!conversation) {
      console.log('❌ Conversation not found');
      return;
    }

    // Determine receiver ID
    let receiverId;
    if (senderId === conversation.adminId) {
      receiverId = conversation.customerId;
    } else {
      receiverId = conversation.adminId;
    }

    // Get receiver's FCM token
    const receiver = await usersCollection.findOne({ 
      _id: new ObjectId(receiverId) 
    });
    const sender = await usersCollection.findOne({ 
      _id: new ObjectId(senderId) 
    });

    if (!receiver || !receiver.fcmToken) {
      console.log('❌ Receiver not found or no FCM token');
      return;
    }

    const fcmToken = receiver.fcmToken;
    
    let notificationTitle = 'New Message';
    let notificationBody = '';
    
    if (messageType === 'text') {
      notificationBody = message;
    } else if (messageType === 'image') {
      notificationBody = '📷 Sent an image';
    } else if (messageType === 'video') {
      notificationBody = '🎥 Sent a video';
    } else if (messageType === 'location') {
      notificationBody = '📍 Shared a location';
    } else {
      notificationBody = 'New message';
    }

    if (sender.role === 'admin') {
      notificationTitle = 'KuberCab Support';
    } else {
      notificationTitle = sender?.name || sender?.phone || 'Customer';
    }

    const messagePayload = {
      token: fcmToken,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        conversationId: String(conversationId),
        messageId: String(messageData._id || Date.now()),
        senderId: String(sender._id),
        senderRole: String(sender.role || ''),
        messageType: String(messageType),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: 'new_message'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'kubercab_sound_channel'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await firebaseKuberCab.messaging().send(messagePayload);
    return response;
  } catch (error) {
    console.error('❌ FCM Error:', error);
  }
}

// Group FCM Function
async function sendGroupFCMMessage(message, groupMembers, sender) {
  try {
    const usersCollection = db.collection('users');
    const groupsCollection = db.collection('groups');
    
    // Get group name
    const group = await groupsCollection.findOne({ 
      _id: new ObjectId(message.groupId) 
    });
    
    for (const member of groupMembers) {
      if (member.userId === sender.userId) continue;

      const receiver = await usersCollection.findOne({ 
        _id: new ObjectId(member.userId) 
      });

      if (!receiver || !receiver.fcmToken) continue;

      const notificationTitle = `💬 ${group?.name || 'Group'}`;
      let notificationBody = '';
      
      if (message.messageType === 'text') {
        notificationBody = `${sender.username}: ${message.message}`;
      } else if (message.messageType === 'image') {
        notificationBody = `${sender.username} sent an image`;
      } else if (message.messageType === 'video') {
        notificationBody = `${sender.username} sent a video`;
      } else if (message.messageType === 'location') {
        notificationBody = `${sender.username} shared a location`;
      }

      const messagePayload = {
        token: receiver.fcmToken,
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          groupId: String(message.groupId),
          messageId: String(message._id),
          senderId: String(sender.userId),
          senderName: String(sender.username),
          messageType: String(message.messageType),
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          type: 'new_group_message'
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'kubercab_sound_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      await firebaseKuberCab.messaging().send(messagePayload);
    }
  } catch (error) {
    console.error('❌ Group FCM Error:', error);
  }
}

// Helper Functions
function getSocketsByUserIds(userIds) {
  const sockets = [];
  onlineUsers.forEach((onlineUser, socketId) => {
    if (userIds.includes(onlineUser.userId)) {
      sockets.push({
        socketId: socketId,
        userId: onlineUser.userId
      });
    }
  });
  return sockets;
}

async function getUserGroupIds(userId) {
  const groupMembersCollection = db.collection('group_members');
  const userGroups = await groupMembersCollection.find({
    userId: userId
  }).toArray();
  
  return userGroups.map(ug => ug.groupId);
}

async function updateConversationsForUsers(userIds) {
  const conversationsCollection = db.collection('conversations');
  
  for (const userId of userIds) {
    const userSocket = [...onlineUsers.entries()].find(([_, user]) => user.userId === userId);
    if (userSocket) {
      const [socketId, user] = userSocket;
      
      // Get both individual and group conversations
      const individualConversations = await conversationsCollection
        .find({
          $or: [
            { customerId: user.userId },
            { adminId: user.userId }
          ],
          type: { $ne: 'group' }
        })
        .sort({ lastMessageAt: -1 })
        .toArray();

      const groupConversations = await conversationsCollection
        .find({
          type: 'group',
          groupId: { $in: await getUserGroupIds(user.userId) }
        })
        .sort({ lastMessageAt: -1 })
        .toArray();

      const allConversations = [...individualConversations, ...groupConversations]
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

      io.to(socketId).emit('conversations_update', { conversations: allConversations });
    }
  }
}

function broadcastOnlineUsers() {
  const onlineUsersList = [...onlineUsers.values()];
  io.emit('online_users_update', { onlineUsers: onlineUsersList });
}

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User verification via socket
  socket.on('verify_user_socket', async (data) => {
    try {
      const { userId, phone } = data;
      const usersCollection = db.collection('users');
      const conversationsCollection = db.collection('conversations');

      console.log('🔍 Verifying user via SOCKET:', { userId, phone });

      // Find user by ID and phone
      const user = await usersCollection.findOne({ 
        _id: new ObjectId(userId),
        phone: phone 
      });

      if (!user) {
        console.log('❌ User verification failed: User not found');
        socket.emit('verification_error', { message: 'User not found' });
        return;
      }

      // Update user online status and add to online users
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            isOnline: true,
            lastActive: new Date()
          } 
        }
      );

      // Store user in online users map
      onlineUsers.set(socket.id, {
        socketId: socket.id,
        userId: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name,
        phone: user.phone
      });

      // Get user's conversations (both individual and group)
      let individualConversations = await conversationsCollection
        .find({
          $or: [
            { customerId: user._id.toString() },
            { adminId: user._id.toString() }
          ],
          type: { $ne: 'group' }
        })
        .sort({ lastMessageAt: -1 })
        .toArray();

      // Get group conversations
      const groupIds = await getUserGroupIds(user._id.toString());
      const groupConversations = await conversationsCollection
        .find({
          type: 'group',
          groupId: { $in: groupIds }
        })
        .sort({ lastMessageAt: -1 })
        .toArray();

      const allConversations = [...individualConversations, ...groupConversations]
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

      console.log('✅ User verified via SOCKET, conversations:', allConversations.length);

      socket.emit('user_verified_socket', {
        user: {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
          name: user.name,
          phone: user.phone
        },
        conversations: allConversations
      });

      // Notify about user online status
      broadcastOnlineUsers();

    } catch (error) {
      console.error('❌ User verification socket error:', error);
      socket.emit('verification_error', { message: 'Verification failed' });
    }
  });

  // Admin login
  socket.on('admin_login', async (data) => {
    try {
      const { username, password } = data;
      const usersCollection = db.collection('users');
      const conversationsCollection = db.collection('conversations');
      
      // Find admin user
      const admin = await usersCollection.findOne({ 
        username: username,
        role: 'admin' 
      });
      
      if (!admin) {
        socket.emit('login_error', { message: 'Admin not found' });
        return;
      }
      
      // Check password
      if (admin.password !== password) {
        socket.emit('login_error', { message: 'Invalid password' });
        return;
      }
      
      // Update admin online status
      await usersCollection.updateOne(
        { _id: admin._id },
        { $set: { isOnline: true } }
      );
      
      // Store admin in online users map
      onlineUsers.set(socket.id, {
        socketId: socket.id,
        userId: admin._id.toString(),
        username: admin.username,
        role: admin.role,
        name: admin.name
      });
      
      // Get all conversations for admin (individual and group)
      const individualConversations = await conversationsCollection
        .find({ 
          $or: [
            { adminId: admin._id.toString() },
            { customerId: admin._id.toString() }
          ],
          type: { $ne: 'group' }
        })
        .sort({ lastMessageAt: -1 })
        .toArray();

      // Get admin's groups
      const groupIds = await getUserGroupIds(admin._id.toString());
      const groupConversations = await conversationsCollection
        .find({
          type: 'group',
          groupId: { $in: groupIds }
        })
        .sort({ lastMessageAt: -1 })
        .toArray();

      const allConversations = [...individualConversations, ...groupConversations]
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      
      socket.emit('login_success', {
        user: {
          id: admin._id.toString(),
          username: admin.username,
          role: admin.role,
          name: admin.name
        },
        conversations: allConversations
      });
      
      // Notify about admin online status
      broadcastOnlineUsers();
      
    } catch (error) {
      console.error('Admin login error:', error);
      socket.emit('login_error', { message: 'Admin login failed' });
    }
  });

  // User registration
  socket.on('register', async (data) => {
    try {
      const { username, phone, name, docs, password } = data;
      const usersCollection = db.collection('users');
      const conversationsCollection = db.collection('conversations');
      
      // Check if user already exists with same phone
      const existingUser = await usersCollection.findOne({ phone });
      if (existingUser) {
        socket.emit('registration_error', { message: 'User with this phone number already exists' });
        return;
      }
      
      // Create new customer with additional details
      const newUser = {
        username,
        phone,
        name,
        docs,
        password,
        role: 'customer',
        createdAt: new Date(),
        isOnline: true,
        isVerified: false
      };
      
      const result = await usersCollection.insertOne(newUser);
      newUser._id = result.insertedId;
      
      // Store user in online users map
      onlineUsers.set(socket.id, {
        socketId: socket.id,
        userId: newUser._id.toString(),
        username: newUser.username,
        role: newUser.role
      });
      
      // Get admin and create conversation
      const admin = await usersCollection.findOne({ role: 'admin' });
      let conversations = [];
      
      if (admin) {
        const newConversation = {
          adminId: admin._id.toString(),
          customerId: newUser._id.toString(),
          customerUsername: newUser.username,
          customerName: newUser.name,
          customerPhone: newUser.phone,
          createdAt: new Date(),
          lastMessageAt: new Date(),
          lastMessage: 'Conversation started',
          unreadCount: 0,
          type: 'individual'
        };
        
        const convResult = await conversationsCollection.insertOne(newConversation);
        newConversation._id = convResult.insertedId;
        conversations = [newConversation];
      }
      
      socket.emit('registration_success', {
        user: {
          id: newUser._id.toString(),
          username: newUser.username,
          role: newUser.role,
          name: newUser.name,
          phone: newUser.phone
        },
        conversations
      });
      
      // Notify admin about new customer registration
      if (admin) {
        notifyAdminAboutNewCustomer(newUser);
      }
      
      // Notify about user online status
      broadcastOnlineUsers();
      
    } catch (error) {
      console.error('Registration error:', error);
      socket.emit('registration_error', { message: 'Registration failed' });
    }
  });

  // Customer login
  socket.on('login', async (data) => {
    try {
      const { phone } = data;
      const usersCollection = db.collection('users');
      const conversationsCollection = db.collection('conversations');
      
      // Find user by phone number
      let user = await usersCollection.findOne({ phone });
      
      if (!user) {
        socket.emit('user_not_found');
        return;
      }
      
      // Update user online status
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { isOnline: true } }
      );
      
      // Store user in online users map
      onlineUsers.set(socket.id, {
        socketId: socket.id,
        userId: user._id.toString(),
        username: user.username,
        role: user.role
      });
      
      // Get user's conversations (individual and group)
      let individualConversations = await conversationsCollection
        .find({
          $or: [
            { customerId: user._id.toString() },
            { adminId: user._id.toString() }
          ],
          type: { $ne: 'group' }
        })
        .sort({ lastMessageAt: -1 })
        .toArray();

      // Get group conversations
      const groupIds = await getUserGroupIds(user._id.toString());
      const groupConversations = await conversationsCollection
        .find({
          type: 'group',
          groupId: { $in: groupIds }
        })
        .sort({ lastMessageAt: -1 })
        .toArray();

      const allConversations = [...individualConversations, ...groupConversations]
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      
      socket.emit('login_success', {
        user: {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
          name: user.name,
          phone: user.phone
        },
        conversations: allConversations
      });
      
      // Notify about user online status
      broadcastOnlineUsers();
      
    } catch (error) {
      console.error('Login error:', error);
      socket.emit('login_error', { message: 'Login failed' });
    }
  });

  // Get conversation messages
  socket.on('get_messages', async (data) => {
    try {
      const { conversationId, page = 1, limit = 20 } = data;
      const messagesCollection = db.collection('messages');
      
      const skip = (page - 1) * limit;
      
      const messages = await messagesCollection
        .find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      socket.emit('messages_data', {
        conversationId,
        messages: messages.reverse(),
        page,
        hasMore: messages.length === limit
      });
      
    } catch (error) {
      console.error('Get messages error:', error);
      socket.emit('messages_error', { message: 'Failed to load messages' });
    }
  });

  // Send individual message
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, message, senderId, senderRole, messageType = 'text', fileUrl, location } = data;
      const messagesCollection = db.collection('messages');
      const conversationsCollection = db.collection('conversations');
        
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      let lastMessagePreview = '';
      
      if (messageType === 'text') {
        lastMessagePreview = message;
      } else if (messageType === 'image') {
        lastMessagePreview = '📷 Image';
      } else if (messageType === 'video') {
        lastMessagePreview = '🎥 Video';
      } else if (messageType === 'location') {
        lastMessagePreview = '📍 Location';
      }
      
      const newMessage = {
        conversationId,
        message,
        senderId,
        senderRole,
        messageType,
        fileUrl,
        location,
        createdAt: new Date(),
        read: false,
        isGroupMessage: false
      };
     
      const result = await messagesCollection.insertOne(newMessage);
      newMessage._id = result.insertedId;
      
      // Update conversation last message
      await conversationsCollection.updateOne(
        { _id: new ObjectId(conversationId) },
        { 
          $set: { 
            lastMessage: lastMessagePreview,
            lastMessageAt: new Date()
          }
        }
      );

      // Get conversation data for FCM
      const conversationData = await conversationsCollection.findOne({
        _id: new ObjectId(conversationId)
      });

      // Send FCM notification
      await sendFCMMessage({ ...conversationData, ...newMessage });
      
      // Emit message to all users in the conversation
      const conversation = await conversationsCollection.findOne({ 
        _id: new ObjectId(conversationId) 
      });
      
      if (conversation) {
        // Find socket IDs of users in this conversation
        const targetUserIds = [conversation.adminId, conversation.customerId];
        
        onlineUsers.forEach((onlineUser, socketId) => {
          if (targetUserIds.includes(onlineUser.userId)) {
            io.to(socketId).emit('new_message', {
              conversationId,
              message: newMessage
            });
          }
        });
        
        // Update conversations list for both users
        updateConversationsForUsers(targetUserIds);
      }
      
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message_error', { message: 'Failed to send message' });
    }
  });

  // GROUP CHAT EVENTS

  // Admin creates a new group
  socket.on('create_group', async (data) => {
    try {
      const { groupName, description, members = [] } = data;
      const user = onlineUsers.get(socket.id);
      
      if (!user || user.role !== 'admin') {
        socket.emit('group_error', { message: 'Only admins can create groups' });
        return;
      }

      const groupsCollection = db.collection('groups');
      const groupMembersCollection = db.collection('group_members');
      const usersCollection = db.collection('users');

      // Create new group
      const newGroup = {
        name: groupName,
        description: description || '',
        createdBy: user.userId,
        adminName: user.username,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        memberCount: members.length + 1
      };

      const groupResult = await groupsCollection.insertOne(newGroup);
      newGroup._id = groupResult.insertedId;

      // Add admin as group member
      const groupMembers = [
        {
          groupId: newGroup._id.toString(),
          userId: user.userId,
          role: 'admin',
          joinedAt: new Date(),
          addedBy: user.userId,
          userName: user.username
        }
      ];

      // Add other members
      for (const memberId of members) {
        const memberUser = await usersCollection.findOne({ 
          _id: new ObjectId(memberId) 
        });
        
        if (memberUser) {
          groupMembers.push({
            groupId: newGroup._id.toString(),
            userId: memberId,
            role: 'member',
            joinedAt: new Date(),
            addedBy: user.userId,
            userName: memberUser.username || memberUser.name || 'User'
          });
        }
      }

      // Insert all group members
      if (groupMembers.length > 0) {
        await groupMembersCollection.insertMany(groupMembers);
      }

      // Create group conversation
      const conversationsCollection = db.collection('conversations');
      const newConversation = {
        type: 'group',
        groupId: newGroup._id.toString(),
        groupName: newGroup.name,
        createdBy: user.userId,
        createdAt: new Date(),
        lastMessageAt: new Date(),
        lastMessage: 'Group created by ' + user.username,
        unreadCount: 0,
        memberCount: groupMembers.length,
        isGroup: true
      };

      const convResult = await conversationsCollection.insertOne(newConversation);
      newConversation._id = convResult.insertedId;

      // Notify all members about the new group
      const memberSockets = getSocketsByUserIds(groupMembers.map(m => m.userId));
      memberSockets.forEach(memberSocket => {
        io.to(memberSocket.socketId).emit('group_created', {
          group: newGroup,
          conversation: newConversation,
          members: groupMembers
        });
      });

      // Update conversations for all members
      updateConversationsForUsers(groupMembers.map(m => m.userId));

      socket.emit('group_created_success', {
        group: newGroup,
        conversation: newConversation
      });

    } catch (error) {
      console.error('Create group error:', error);
      socket.emit('group_error', { message: 'Failed to create group' });
    }
  });

  // Add members to existing group
  socket.on('add_group_members', async (data) => {
    try {
      const { groupId, members } = data;
      const user = onlineUsers.get(socket.id);
      
      if (!user || user.role !== 'admin') {
        socket.emit('group_error', { message: 'Only admins can add members' });
        return;
      }

      const groupsCollection = db.collection('groups');
      const groupMembersCollection = db.collection('group_members');
      const usersCollection = db.collection('users');
      const conversationsCollection = db.collection('conversations');

      // Verify group exists
      const group = await groupsCollection.findOne({ 
        _id: new ObjectId(groupId)
      });

      if (!group) {
        socket.emit('group_error', { message: 'Group not found' });
        return;
      }

      const newMembers = [];
      for (const memberId of members) {
        const memberUser = await usersCollection.findOne({ 
          _id: new ObjectId(memberId) 
        });
        
        if (memberUser) {
          // Check if user is already in group
          const existingMember = await groupMembersCollection.findOne({
            groupId: groupId,
            userId: memberId
          });

          if (!existingMember) {
            newMembers.push({
              groupId: groupId,
              userId: memberId,
              role: 'member',
              joinedAt: new Date(),
              addedBy: user.userId,
              userName: memberUser.username || memberUser.name || 'User'
            });
          }
        }
      }

      // Add new members
      if (newMembers.length > 0) {
        await groupMembersCollection.insertMany(newMembers);

        // Update group member count
        await groupsCollection.updateOne(
          { _id: new ObjectId(groupId) },
          { 
            $inc: { memberCount: newMembers.length },
            $set: { updatedAt: new Date() }
          }
        );

        // Update conversation member count
        await conversationsCollection.updateOne(
          { groupId: groupId },
          { 
            $inc: { memberCount: newMembers.length },
            $set: { updatedAt: new Date() }
          }
        );

        // Notify existing group members
        const allMembers = await groupMembersCollection.find({ 
          groupId: groupId 
        }).toArray();

        const memberSockets = getSocketsByUserIds(allMembers.map(m => m.userId));
        memberSockets.forEach(memberSocket => {
          io.to(memberSocket.socketId).emit('group_members_added', {
            groupId: groupId,
            newMembers: newMembers,
            addedBy: user.username
          });
        });

        // Notify new members
        const newMemberSockets = getSocketsByUserIds(newMembers.map(m => m.userId));
        newMemberSockets.forEach(memberSocket => {
          io.to(memberSocket.socketId).emit('added_to_group', {
            group: group,
            addedBy: user.username
          });
        });

        // Update conversations for all members
        updateConversationsForUsers(allMembers.map(m => m.userId));
      }

      socket.emit('members_added_success', {
        groupId: groupId,
        addedCount: newMembers.length
      });

    } catch (error) {
      console.error('Add group members error:', error);
      socket.emit('group_error', { message: 'Failed to add members' });
    }
  });

  // Get user's groups
  socket.on('get_user_groups', async (data) => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      const groupMembersCollection = db.collection('group_members');
      const groupsCollection = db.collection('groups');
      const conversationsCollection = db.collection('conversations');

      // Get groups where user is a member
      const userGroups = await groupMembersCollection.find({
        userId: user.userId
      }).toArray();

      const groupIds = userGroups.map(ug => ug.groupId);

      // Get group details
      const groups = await groupsCollection.find({
        _id: { $in: groupIds.map(id => new ObjectId(id)) }
      }).toArray();

      // Get group conversations
      const groupConversations = await conversationsCollection.find({
        groupId: { $in: groupIds },
        type: 'group'
      }).sort({ lastMessageAt: -1 }).toArray();

      socket.emit('user_groups_data', {
        groups: groups,
        conversations: groupConversations
      });

    } catch (error) {
      console.error('Get user groups error:', error);
      socket.emit('group_error', { message: 'Failed to load groups' });
    }
  });

  // Send message to group
  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, message, messageType = 'text', fileUrl, location } = data;
      const user = onlineUsers.get(socket.id);
      
      if (!user) return;

      const messagesCollection = db.collection('messages');
      const conversationsCollection = db.collection('conversations');
      const groupMembersCollection = db.collection('group_members');

      // Verify user is member of the group
      const isMember = await groupMembersCollection.findOne({
        groupId: groupId,
        userId: user.userId
      });

      if (!isMember) {
        socket.emit('message_error', { message: 'You are not a member of this group' });
        return;
      }

      let lastMessagePreview = '';
      
      if (messageType === 'text') {
        lastMessagePreview = message.length > 50 ? message.substring(0, 50) + '...' : message;
      } else if (messageType === 'image') {
        lastMessagePreview = '📷 Image';
      } else if (messageType === 'video') {
        lastMessagePreview = '🎥 Video';
      } else if (messageType === 'location') {
        lastMessagePreview = '📍 Location';
      }

      const newMessage = {
        conversationId: groupId,
        message,
        senderId: user.userId,
        senderRole: user.role,
        senderName: user.username,
        messageType,
        fileUrl,
        location,
        isGroupMessage: true,
        groupId: groupId,
        createdAt: new Date(),
        readBy: [user.userId]
      };

      const result = await messagesCollection.insertOne(newMessage);
      newMessage._id = result.insertedId;

      // Update group conversation
      await conversationsCollection.updateOne(
        { groupId: groupId },
        { 
          $set: { 
            lastMessage: lastMessagePreview,
            lastMessageAt: new Date()
          }
        }
      );

      // Get all group members
      const groupMembers = await groupMembersCollection.find({
        groupId: groupId
      }).toArray();

      // Emit message to all online group members
      const memberSockets = getSocketsByUserIds(groupMembers.map(m => m.userId));
      memberSockets.forEach(memberSocket => {
        io.to(memberSocket.socketId).emit('new_group_message', {
          groupId: groupId,
          message: newMessage
        });
      });

      // Send FCM notifications to offline members
      await sendGroupFCMMessage(newMessage, groupMembers, user);

      // Update conversations list for all members
      updateConversationsForUsers(groupMembers.map(m => m.userId));

    } catch (error) {
      console.error('Send group message error:', error);
      socket.emit('message_error', { message: 'Failed to send message' });
    }
  });

  // Get group messages
  socket.on('get_group_messages', async (data) => {
    try {
      const { groupId, page = 1, limit = 20 } = data;
      const messagesCollection = db.collection('messages');
      
      const skip = (page - 1) * limit;
      
      const messages = await messagesCollection
        .find({ 
          groupId: groupId,
          isGroupMessage: true 
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      socket.emit('group_messages_data', {
        groupId,
        messages: messages.reverse(),
        page,
        hasMore: messages.length === limit
      });
      
    } catch (error) {
      console.error('Get group messages error:', error);
      socket.emit('messages_error', { message: 'Failed to load messages' });
    }
  });

  // Get users for adding to group (admin only)
  socket.on('get_users_for_group', async (data) => {
    try {
      const user = onlineUsers.get(socket.id);
      
      if (!user || user.role !== 'admin') {
        socket.emit('group_error', { message: 'Access denied' });
        return;
      }

      const usersCollection = db.collection('users');
      const users = await usersCollection.find({
       
        _id: { $ne: new ObjectId(user.userId) }
      }).project({
        username: 1,
        name: 1,
        phone: 1,
        isOnline: 1
      }).toArray();

      socket.emit('users_for_group_data', {
        users: users.map(u => ({
          id: u._id.toString(),
          username: u.username,
          name: u.name,
          phone: u.phone,
          isOnline: u.isOnline
        }))
      });

    } catch (error) {
      console.error('Get users for group error:', error);
      socket.emit('group_error', { message: 'Failed to load users' });
    }
  });

  // Get group members
  socket.on('get_group_members', async (data) => {
    try {
      const { groupId } = data;
      const groupMembersCollection = db.collection('group_members');
      const usersCollection = db.collection('users');

      const members = await groupMembersCollection.find({
        groupId: groupId
      }).toArray();

      // Get user details for each member
      const membersWithDetails = await Promise.all(
        members.map(async (member) => {
          const user = await usersCollection.findOne({
            _id: new ObjectId(member.userId)
          });
          
          return {
            ...member,
            userDetails: {
              name: user?.name,
              username: user?.username,
              phone: user?.phone,
              isOnline: user?.isOnline
            }
          };
        })
      );

      socket.emit('group_members_data', {
        groupId: groupId,
        members: membersWithDetails
      });

    } catch (error) {
      console.error('Get group members error:', error);
      socket.emit('group_error', { message: 'Failed to load group members' });
    }
  });

  // Typing events for individual chats
  socket.on('typing_start', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_typing', {
        conversationId: data.conversationId,
        username: user.username,
        isTyping: true
      });
    }
  });

  socket.on('typing_stop', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_typing', {
        conversationId: data.conversationId,
        username: user.username,
        isTyping: false
      });
    }
  });

  // Typing events for groups
  socket.on('group_typing_start', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_group_typing', {
        groupId: data.groupId,
        username: user.username,
        isTyping: true
      });
    }
  });

  socket.on('group_typing_stop', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_group_typing', {
        groupId: data.groupId,
        username: user.username,
        isTyping: false
      });
    }
  });

  // Socket session info
  socket.on('socket_session_info', (data) => {
    console.log('📱 Socket session info:', data);
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      const user = onlineUsers.get(socket.id);
      if (user) {
        const usersCollection = db.collection('users');
        await usersCollection.updateOne(
          { _id: new ObjectId(user.userId) },
          { $set: { isOnline: false } }
        );
        
        onlineUsers.delete(socket.id);
        broadcastOnlineUsers();
        console.log('User disconnected:', user.username);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  });










socket.on('delete_conversation', async (data) => {
  try {
    const { conversationId, userId } = data;
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');

    // Verify user has permission to delete this conversation
    const conversation = await conversationsCollection.findOne({
      _id: new ObjectId(conversationId),
      $or: [
        { customerId: userId },
        { adminId: userId }
      ]
    });

    if (!conversation) {
      socket.emit('conversation_error', { message: 'Conversation not found or access denied' });
      return;
    }

    if (conversation.isGroup) {
      socket.emit('conversation_error', { message: 'Cannot delete group conversations' });
      return;
    }

    // Delete all messages in this conversation
    await messagesCollection.deleteMany({ conversationId: conversationId });

    // Delete the conversation
    await conversationsCollection.deleteOne({ _id: new ObjectId(conversationId) });

    // Notify both users about the deletion
    const targetUserIds = [conversation.adminId, conversation.customerId];
    
    onlineUsers.forEach((onlineUser, socketId) => {
      if (targetUserIds.includes(onlineUser.userId)) {
        io.to(socketId).emit('conversation_deleted', {
          conversationId: conversationId
        });
      }
    });

    // Update conversations list for both users
    updateConversationsForUsers(targetUserIds);

    console.log(`✅ Conversation ${conversationId} deleted by user ${userId}`);

  } catch (error) {
    console.error('Delete conversation error:', error);
    socket.emit('conversation_error', { message: 'Failed to delete conversation' });
  }
});

// Block conversation
socket.on('block_conversation', async (data) => {
  try {
    const { conversationId, userId } = data;
    const conversationsCollection = db.collection('conversations');

    // Verify user has permission to block this conversation
    const conversation = await conversationsCollection.findOne({
      _id: new ObjectId(conversationId),
      $or: [
        { customerId: userId },
        { adminId: userId }
      ]
    });

    if (!conversation) {
      socket.emit('conversation_error', { message: 'Conversation not found or access denied' });
      return;
    }

    if (conversation.isGroup) {
      socket.emit('conversation_error', { message: 'Cannot block group conversations' });
      return;
    }

    // Update conversation with blocked status
    await conversationsCollection.updateOne(
      { _id: new ObjectId(conversationId) },
      { 
        $set: { 
          isBlocked: true,
          blockedBy: userId,
          blockedAt: new Date()
        } 
      }
    );

    // Notify both users about the block
    const targetUserIds = [conversation.adminId, conversation.customerId];
    
    onlineUsers.forEach((onlineUser, socketId) => {
      if (targetUserIds.includes(onlineUser.userId)) {
        io.to(socketId).emit('conversation_blocked', {
          conversationId: conversationId,
          blockedBy: userId
        });
      }
    });

    // Update conversations list for both users
    updateConversationsForUsers(targetUserIds);

    console.log(`🚫 Conversation ${conversationId} blocked by user ${userId}`);

  } catch (error) {
    console.error('Block conversation error:', error);
    socket.emit('conversation_error', { message: 'Failed to block conversation' });
  }
});

// Unblock conversation
socket.on('unblock_conversation', async (data) => {
  try {
    const { conversationId, userId } = data;
    const conversationsCollection = db.collection('conversations');

    // Verify user has permission to unblock this conversation
    const conversation = await conversationsCollection.findOne({
      _id: new ObjectId(conversationId),
      $or: [
        { customerId: userId },
        { adminId: userId }
      ]
    });

    if (!conversation) {
      socket.emit('conversation_error', { message: 'Conversation not found or access denied' });
      return;
    }

    // Update conversation to remove blocked status
    await conversationsCollection.updateOne(
      { _id: new ObjectId(conversationId) },
      { 
        $set: { 
          isBlocked: false 
        },
        $unset: {
          blockedBy: "",
          blockedAt: ""
        }
      }
    );

    // Notify both users about the unblock
    const targetUserIds = [conversation.adminId, conversation.customerId];
    
    onlineUsers.forEach((onlineUser, socketId) => {
      if (targetUserIds.includes(onlineUser.userId)) {
        io.to(socketId).emit('conversation_unblocked', {
          conversationId: conversationId,
          unblockedBy: userId
        });
      }
    });

    // Update conversations list for both users
    updateConversationsForUsers(targetUserIds);

    console.log(`✅ Conversation ${conversationId} unblocked by user ${userId}`);

  } catch (error) {
    console.error('Unblock conversation error:', error);
    socket.emit('conversation_error', { message: 'Failed to unblock conversation' });
  }
});




// Delete message in personal chat
socket.on('delete_message', async (data) => {
  try {
    const { conversationId, messageId, userId } = data;
    const messagesCollection = db.collection('messages');
    const conversationsCollection = db.collection('conversations');

    // Find the message
    const message = await messagesCollection.findOne({
      _id: new ObjectId(messageId),
      conversationId: conversationId
    });

    if (!message) {
      socket.emit('message_error', { message: 'Message not found' });
      return;
    }

    // Check if user has permission to delete this message
    if (message.senderId !== userId) {
      socket.emit('message_error', { message: 'You can only delete your own messages' });
      return;
    }

    // Delete the message
    await messagesCollection.deleteOne({ _id: new ObjectId(messageId) });

    // Get conversation to notify both users
    const conversation = await conversationsCollection.findOne({
      _id: new ObjectId(conversationId)
    });

    if (conversation) {
      // Notify both users in the conversation
      const targetUserIds = [conversation.adminId, conversation.customerId];
      
      onlineUsers.forEach((onlineUser, socketId) => {
        if (targetUserIds.includes(onlineUser.userId)) {
          io.to(socketId).emit('message_deleted', {
            conversationId: conversationId,
            messageId: messageId
          });
        }
      });
    }

    console.log(`🗑️ Message ${messageId} deleted by user ${userId}`);

  } catch (error) {
    console.error('Delete message error:', error);
    socket.emit('message_error', { message: 'Failed to delete message' });
  }
});

// Delete message in group chat
socket.on('delete_group_message', async (data) => {
  try {
    const { groupId, messageId, userId } = data;
    const messagesCollection = db.collection('messages');
    const groupMembersCollection = db.collection('group_members');

    // Find the message
    const message = await messagesCollection.findOne({
      _id: new ObjectId(messageId),
      groupId: groupId
    });

    if (!message) {
      socket.emit('message_error', { message: 'Message not found' });
      return;
    }

    // Check if user is admin (only admin can delete messages in group)
    const userMembership = await groupMembersCollection.findOne({
      groupId: groupId,
      userId: userId,
      role: 'admin'
    });

    if (!userMembership) {
      socket.emit('message_error', { message: 'Only admin can delete messages in group' });
      return;
    }

    // Delete the message
    await messagesCollection.deleteOne({ _id: new ObjectId(messageId) });

    // Get all group members to notify them
    const groupMembers = await groupMembersCollection.find({
      groupId: groupId
    }).toArray();

    // Notify all group members
    const memberSockets = getSocketsByUserIds(groupMembers.map(m => m.userId));
    memberSockets.forEach(memberSocket => {
      io.to(memberSocket.socketId).emit('group_message_deleted', {
        groupId: groupId,
        messageId: messageId
      });
    });

    console.log(`🗑️ Group message ${messageId} deleted by admin ${userId}`);

  } catch (error) {
    console.error('Delete group message error:', error);
    socket.emit('message_error', { message: 'Failed to delete message' });
  }
});




























// Remove member from group (admin only)
socket.on('remove_group_member', async (data) => {
  try {
    const { groupId, memberId } = data;
    const user = onlineUsers.get(socket.id);
    
    if (!user || user.role !== 'admin') {
      socket.emit('group_error', { message: 'Only admins can remove members' });
      return;
    }

    const groupsCollection = db.collection('groups');
    const groupMembersCollection = db.collection('group_members');
    const conversationsCollection = db.collection('conversations');
    const usersCollection = db.collection('users');

    // Verify group exists and user is admin
    const group = await groupsCollection.findOne({ 
      _id: new ObjectId(groupId),
      createdBy: user.userId
    });

    if (!group) {
      socket.emit('group_error', { message: 'Group not found or access denied' });
      return;
    }

    // Prevent admin from removing themselves
    if (memberId === user.userId) {
      socket.emit('group_error', { message: 'You cannot remove yourself from the group' });
      return;
    }

    // Remove member from group_members collection
    const deleteResult = await groupMembersCollection.deleteOne({
      groupId: groupId,
      userId: memberId
    });

    if (deleteResult.deletedCount === 0) {
      socket.emit('group_error', { message: 'Member not found in group' });
      return;
    }

    // Update group member count
    await groupsCollection.updateOne(
      { _id: new ObjectId(groupId) },
      { 
        $inc: { memberCount: -1 },
        $set: { updatedAt: new Date() }
      }
    );

    // Update conversation member count
    await conversationsCollection.updateOne(
      { groupId: groupId },
      { 
        $inc: { memberCount: -1 },
        $set: { updatedAt: new Date() }
      }
    );

    // Get member details for notification
    const removedMember = await usersCollection.findOne({
      _id: new ObjectId(memberId)
    });

    // Get all remaining group members
    const remainingMembers = await groupMembersCollection.find({
      groupId: groupId
    }).toArray();

    // Notify all remaining group members
    const memberSockets = getSocketsByUserIds(remainingMembers.map(m => m.userId));
    memberSockets.forEach(memberSocket => {
      io.to(memberSocket.socketId).emit('group_member_removed', {
        groupId: groupId,
        removedMemberId: memberId,
        removedMemberName: removedMember?.username || 'User',
        removedBy: user.username,
        newMemberCount: group.memberCount - 1
      });
    });

    // Notify the removed user
    const removedUserSocket = getSocketsByUserIds([memberId]);
    removedUserSocket.forEach(userSocket => {
      io.to(userSocket.socketId).emit('removed_from_group', {
        groupId: groupId,
        groupName: group.name,
        removedBy: user.username
      });
    });

    // Update conversations for all remaining members
    updateConversationsForUsers(remainingMembers.map(m => m.userId));

    console.log(`✅ Member ${memberId} removed from group ${groupId} by admin ${user.userId}`);

    socket.emit('member_removed_success', {
      groupId: groupId,
      removedMemberId: memberId
    });

  } catch (error) {
    console.error('Remove group member error:', error);
    socket.emit('group_error', { message: 'Failed to remove member' });
  }
});

// User leaves group
socket.on('leave_group', async (data) => {
  try {
    const { groupId } = data;
    const user = onlineUsers.get(socket.id);
    
    if (!user) {
      socket.emit('group_error', { message: 'User not found' });
      return;
    }

    const groupsCollection = db.collection('groups');
    const groupMembersCollection = db.collection('group_members');
    const conversationsCollection = db.collection('conversations');

    // Check if user is a member of the group
    const userMembership = await groupMembersCollection.findOne({
      groupId: groupId,
      userId: user.userId
    });

    if (!userMembership) {
      socket.emit('group_error', { message: 'You are not a member of this group' });
      return;
    }

    // Prevent admin from leaving (they must delete the group instead)
    if (userMembership.role === 'admin') {
      socket.emit('group_error', { message: 'Admin cannot leave group. Please delete the group instead.' });
      return;
    }

    // Remove user from group_members collection
    await groupMembersCollection.deleteOne({
      groupId: groupId,
      userId: user.userId
    });

    // Update group member count
    await groupsCollection.updateOne(
      { _id: new ObjectId(groupId) },
      { 
        $inc: { memberCount: -1 },
        $set: { updatedAt: new Date() }
      }
    );

    // Update conversation member count
    await conversationsCollection.updateOne(
      { groupId: groupId },
      { 
        $inc: { memberCount: -1 },
        $set: { updatedAt: new Date() }
      }
    );

    // Get all remaining group members
    const remainingMembers = await groupMembersCollection.find({
      groupId: groupId
    }).toArray();

    // Notify remaining group members
    const memberSockets = getSocketsByUserIds(remainingMembers.map(m => m.userId));
    memberSockets.forEach(memberSocket => {
      io.to(memberSocket.socketId).emit('group_member_left', {
        groupId: groupId,
        leftMemberId: user.userId,
        leftMemberName: user.username,
        newMemberCount: group.memberCount - 1
      });
    });

    // Update conversations for remaining members
    updateConversationsForUsers(remainingMembers.map(m => m.userId));

    // Remove group from user's conversations
    updateConversationsForUsers([user.userId]);

    console.log(`✅ User ${user.userId} left group ${groupId}`);

    socket.emit('left_group_success', {
      groupId: groupId
    });

  } catch (error) {
    console.error('Leave group error:', error);
    socket.emit('group_error', { message: 'Failed to leave group' });
  }
});

// Delete group (admin only)
socket.on('delete_group', async (data) => {
  try {
    const { groupId } = data;
    const user = onlineUsers.get(socket.id);
    
    if (!user || user.role !== 'admin') {
      socket.emit('group_error', { message: 'Only admins can delete groups' });
      return;
    }

    const groupsCollection = db.collection('groups');
    const groupMembersCollection = db.collection('group_members');
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');

    // Verify group exists and user is the creator
    const group = await groupsCollection.findOne({ 
      _id: new ObjectId(groupId),
      createdBy: user.userId
    });

    if (!group) {
      socket.emit('group_error', { message: 'Group not found or access denied' });
      return;
    }

    // Get all group members before deletion
    const groupMembers = await groupMembersCollection.find({
      groupId: groupId
    }).toArray();

    const memberIds = groupMembers.map(m => m.userId);

    // Delete all related data in transaction
    await Promise.all([
      // Delete group
      groupsCollection.deleteOne({ _id: new ObjectId(groupId) }),
      // Delete group members
      groupMembersCollection.deleteMany({ groupId: groupId }),
      // Delete group conversation
      conversationsCollection.deleteOne({ groupId: groupId }),
      // Delete group messages
      messagesCollection.deleteMany({ groupId: groupId })
    ]);

    // Notify all former group members
    const memberSockets = getSocketsByUserIds(memberIds);
    memberSockets.forEach(memberSocket => {
      io.to(memberSocket.socketId).emit('group_deleted', {
        groupId: groupId,
        groupName: group.name,
        deletedBy: user.username
      });
    });

    // Update conversations for all former members
    updateConversationsForUsers(memberIds);

    console.log(`🗑️ Group ${groupId} deleted by admin ${user.userId}`);

    socket.emit('group_deleted_success', {
      groupId: groupId
    });

  } catch (error) {
    console.error('Delete group error:', error);
    socket.emit('group_error', { message: 'Failed to delete group' });
  }
});


























  // Helper function to notify admin about new customer
  async function notifyAdminAboutNewCustomer(customer) {
    const admin = onlineUsers.get([...onlineUsers.entries()].find(([_, user]) => user.role === 'admin')?.[0]);
    if (admin) {
      io.to(admin.socketId).emit('new_customer', { customer });
    }
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Group chat features enabled: Admin can create groups and add members`);
});