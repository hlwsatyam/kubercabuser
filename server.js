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
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// MongoDB connection
const mongoURL = 'mongodb://localhost:27017';
const dbName = 'chat_app';
let db;
 
// Connect to MongoDB
MongoClient.connect(mongoURL, { useUnifiedTopology: true })
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
    initializeAdmin();
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


const connectDB = require('./config/database.js');
const { firebaseKuberCab } = require('./config/firebaseApps.js');
connectDB();

 
app.use('/api/messages', require('./routes/messages.js'));
app.use('/api/banners', require('./routes/banners.js'));
app.use('/api/packages', require('./routes/packages.js'));
 
app.use('/api/token', (req, res, next) => {
      req.db = db;
      next();
    },require('./routes/token.js'));


 



// Store online users
const onlineUsers = new Map();

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




 


 async function sendFCMMessage(messageData) {
  try {
    const { conversationId,messageType, message,senderId: senderId } = messageData;
    const usersCollection = db.collection('users');
    const conversationsCollection = db.collection('conversations');

   

    // 🔹 GET CONVERSATION DETAILS
    const conversation = await conversationsCollection.findOne({ 
      _id: new ObjectId(conversationId) 
    });

    if (!conversation) {
      console.log('❌ Conversation not found');
      return;
    }

    // 🔹 DETERMINE RECEIVER ID BASED ON SENDER ID
    let receiverId;
    if (senderId === conversation.adminId) {
      // If sender is admin, receiver is customer
      receiverId = conversation.customerId;
    } else {
      // If sender is customer, receiver is admin
      receiverId = conversation.adminId;
    }
 

    // 🔹 GET RECEIVER'S FCM TOKEN
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
    
    // Customize notification based on message type
    if ( messageType === 'text') {
      notificationBody = message;
    } else if ( messageType === 'image') {
      notificationBody = '📷 Sent an image';
    } else if ( messageType === 'location') {
      notificationBody = '📍 Shared a location';
    } else {
      notificationBody = 'New message';
    }

    // Customize title based on sender role
    if (sender.role === 'admin') {
      notificationTitle = 'KuberCab Support';
    } else {
      // Get sender name for customer messages
     
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
    messageId: String(message._id || Date.now()),
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






















io.on('connection', (socket) => {
  console.log('User connected:', socket.id);













 


















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

    // ✅ IMPORTANT: Update user online status and add to online users
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          isOnline: true,
          lastActive: new Date()
        } 
      }
    );

    // ✅ IMPORTANT: Store user in online users map
    onlineUsers.set(socket.id, {
      socketId: socket.id,
      userId: user._id.toString(),
      username: user.username,
      role: user.role
    });

    // Get user's conversations
    let conversations = await conversationsCollection
      .find({
        $or: [
          { customerId: user._id.toString() },
          { adminId: user._id.toString() }
        ]
      })
      .sort({ lastMessageAt: -1 })
      .toArray();

    console.log('✅ User verified via SOCKET, conversations:', conversations.length);

    socket.emit('user_verified_socket', {
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name,
        phone: user.phone
      },
      conversations
    });

    // Notify about user online status
    broadcastOnlineUsers();

  } catch (error) {
    console.error('❌ User verification socket error:', error);
    socket.emit('verification_error', { message: 'Verification failed' });
  }
});
 



























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
    
    // Check password (in production, use proper password hashing)
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
      role: admin.role
    });
    
    // Get all conversations for admin
    const conversations = await conversationsCollection
      .find({ adminId: admin._id.toString() })
      .sort({ lastMessageAt: -1 })
      .toArray();
    
    socket.emit('login_success', {
      user: {
        id: admin._id.toString(),
        username: admin.username,
        role: admin.role,
        name: admin.name
      },
      conversations
    });
    
    // Notify about admin online status
    broadcastOnlineUsers();
    
  } catch (error) {
    console.error('Admin login error:', error);
    socket.emit('login_error', { message: 'Admin login failed' });
  }
});


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
      password, // In production, hash this password
      role: 'customer',
      createdAt: new Date(),
      isOnline: true,
      isVerified: false // You can add verification logic later
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
        unreadCount: 0
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

// Modified customer login handler
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
    
    // Get user's conversations
    let conversations = await conversationsCollection
      .find({
        $or: [
          { customerId: user._id.toString() },
          { adminId: user._id.toString() }
        ]
      })
      .sort({ lastMessageAt: -1 })
      .toArray();
    
    socket.emit('login_success', {
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name,
        phone: user.phone
      },
      conversations
    });
    
    // Notify about user online status
    broadcastOnlineUsers();
    
  } catch (error) {
    console.error('Login error:', error);
    socket.emit('login_error', { message: 'Login failed' });
  }
});















































  // Handle user login
  // socket.on('login', async (data) => {
  //   try {
  //     const { username } = data;
  //     const usersCollection = db.collection('users');
  //     const conversationsCollection = db.collection('conversations');
      
  //     let user = await usersCollection.findOne({ username });
      
  //     if (!user) {
  //       // Create new customer
  //       user = {
  //         username,
  //         role: 'customer',
  //         createdAt: new Date(),
  //         isOnline: true
  //       };
  //       const result = await usersCollection.insertOne(user);
  //       user._id = result.insertedId;
        
  //       console.log('New customer created:', username);
  //     } else {
  //       // Update existing user online status
  //       await usersCollection.updateOne(
  //         { _id: user._id },
  //         { $set: { isOnline: true } }
  //       );
  //     }
      
  //     // Store user in online users map
  //     onlineUsers.set(socket.id, {
  //       socketId: socket.id,
  //       userId: user._id.toString(),
  //       username: user.username,
  //       role: user.role
  //     });
      
  //     // Get user's conversations
  //     let conversations = await conversationsCollection
  //       .find({
  //         $or: [
  //           { customerId: user._id.toString() },
  //           { adminId: user._id.toString() }
  //         ]
  //       })
  //       .sort({ lastMessageAt: -1 })
  //       .toArray();
      
  //     // For customers, ensure they have a conversation with admin
  //     if (user.role === 'customer') {
  //       const admin = await usersCollection.findOne({ role: 'admin' });
  //       let existingConversation = conversations.find(conv => 
  //         conv.adminId === admin._id.toString() && conv.customerId === user._id.toString()
  //       );
        
  //       if (!existingConversation) {
  //         const newConversation = {
  //           adminId: admin._id.toString(),
  //           customerId: user._id.toString(),
  //           customerUsername: user.username,
  //           createdAt: new Date(),
  //           lastMessageAt: new Date(),
  //           lastMessage: 'Conversation started',
  //           unreadCount: 0
  //         };
          
  //         const result = await conversationsCollection.insertOne(newConversation);
  //         newConversation._id = result.insertedId;
  //         conversations.unshift(newConversation);
  //       }
  //     }
      
  //     socket.emit('login_success', {
  //       user: {
  //         id: user._id.toString(),
  //         username: user.username,
  //         role: user.role
  //       },
  //       conversations
  //     });
      
  //     // Notify admin about new customer
  //     if (user.role === 'customer') {
  //       notifyAdminAboutNewCustomer(user);
  //     }
      
  //     // Notify about user online status
  //     broadcastOnlineUsers();
      
  //   } catch (error) {
  //     console.error('Login error:', error);
  //     socket.emit('login_error', { message: 'Login failed' });
  //   }
  // });

  // Handle getting conversation messages with pagination
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

  // Handle sending message
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
        read: false
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


 


const conversationData = await conversationsCollection.findOne({
  _id: new ObjectId(conversationId)
});


         await sendFCMMessage({  ...conversationData , ...newMessage       })
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

  // Handle typing events
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

  // Helper function to notify admin about new customer
  async function notifyAdminAboutNewCustomer(customer) {
    const admin = onlineUsers.get([...onlineUsers.entries()].find(([_, user]) => user.role === 'admin')?.[0]);
    if (admin) {
      io.to(admin.socketId).emit('new_customer', { customer });
    }
  }

  // Helper function to broadcast online users
  function broadcastOnlineUsers() {
    const onlineUsersList = [...onlineUsers.values()];
    io.emit('online_users_update', { onlineUsers: onlineUsersList });
  }

  // Helper function to update conversations for users
  async function updateConversationsForUsers(userIds) {
    const conversationsCollection = db.collection('conversations');
    
    for (const userId of userIds) {
      const userSocket = [...onlineUsers.entries()].find(([_, user]) => user.userId === userId);
      if (userSocket) {
        const [socketId, user] = userSocket;
        const conversations = await conversationsCollection
          .find({
            $or: [
              { customerId: user.userId },
              { adminId: user.userId }
            ]
          })
          .sort({ lastMessageAt: -1 })
          .toArray();
        
        io.to(socketId).emit('conversations_update', { conversations });
      }
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});