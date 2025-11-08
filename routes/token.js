const express = require('express');
const Token = require('../models/Token');
const { default: mongoose } = require('mongoose');
const router = express.Router();
 


// router.post('/', async (req, res) => {
//   try {
//     const { token } = req.body;
// console.log(req.body)
// return
//     // Duplicate token check
//     const exists = await Token.findOne({ token });
//     if (!exists) {
//       await Token.create({ token });
//       console.log('Token saved ✅:', token);
//     }

//     res.json({ success: true });
//   } catch (err) {
//     console.error('Error saving token:', err);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// });







router.post('/', async (req, res) => {
  try {
    const { token, user, docs, name, password } = req.body;
    const db = req.db;
 
 
    // Update user validation and data
    const updateData = { fcmToken: token };
    
  if (docs) updateData.docs = docs;
    if (name) updateData.name = name;
    if (password) {
      // Hash password before storing (use bcrypt in production)
      updateData.password = password;
    }
    
    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(user.id) },
      { $set: updateData }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Token update error:', error);
    res.status(500).json({ error: 'Token update failed' });
  }
});












 
module.exports = router;