const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'kubercab-secret', {
    expiresIn: '30d'
  });
};

// @desc    Register/Login user
// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { mobile,isDriver=false,fcmToken=null,  role="user",  password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide mobile and password'
      });
    }

    // Check if user exists
    let user = await User.findOne({ mobile });

    if (user) {
      // Existing user - verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid mobile or password'
        });
      }


await User.findByIdAndUpdate(user._id,{
  fcmToken,role
})

      // Check if user needs to complete profile
      if (user.isNewUser) {
        return res.json({
          success: true,isDriver,
          isNewUser: true,role,
          mobile: user.mobile,
          message: 'Please complete your profile'
        });
      }

      // Regular login
      const token = generateToken(user._id);

      res.json({
        success: true,
        isNewUser: false,
        token,
        user: {isDriver,
          id: user._id,role,
          name: user.name,
          mobile: user.mobile,
          createdAt: user.createdAt
        }
      });
    } else {
      // New user - create with default password
      user = new User({
        mobile,isDriver,fcmToken,
        password,role,
        isNewUser: true
      });

      await user.save();

      res.json({
        success: true,isDriver,
        isNewUser: true,role,
        mobile: user.mobile,
        message: 'Please complete your profile'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// @desc    Complete user profile
// @route   POST /api/auth/complete-profile
router.post('/complete-profile', async (req, res) => {
  try {
    const { mobile, name, password } = req.body;

    if (!mobile || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide mobile and name'
      });
    }

    let user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user profile
    user.name = name;
    user.isNewUser = false;
    
    if (password) {
      user.password = password;
    }

    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        isDriver:user.isDriver,
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;