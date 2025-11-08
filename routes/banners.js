const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const {upload} = require('../config/multer');
const fs = require('fs');
const path = require('path');

// Get all banners
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new banner with image upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Pleasez upload an image' });
    }

    if (!req.body.header) {
      // Delete uploaded file if header is missing
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Header is required' });
    }

    const banner = new Banner({
      image: req.file.filename,
      header: req.body.header
    });
    
    const newBanner = await banner.save();
    res.status(201).json(newBanner);
  } catch (error) {
    // Delete uploaded file in case of error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});

// Delete banner
router.delete('/:id', async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    
    // Delete image file from uploads folder
    const imagePath = path.join(__dirname, '../uploads', banner.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Serve uploaded images
router.get('/image/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(__dirname, '../uploads', filename);
  
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({ message: 'Image not found' });
  }
});

module.exports = router;