const express = require('express');
const router = express.Router();
const Package = require('../models/Package');
const {upload} = require('../config/multer');
const fs = require('fs');
const path = require('path');

// Get all packages
router.get('/', async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new package
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const {
      name,
      vehicleType,
      capacity,
      ac,
      itinerary,
      inclusions,
      price,
      duration
    } = req.body;

    // Parse itinerary and inclusions from string to array
    const itineraryArray = typeof itinerary === 'string' ? JSON.parse(itinerary) : itinerary;
    const inclusionsArray = typeof inclusions === 'string' ? JSON.parse(inclusions) : inclusions;

    const package = new Package({
      name,
      vehicleType,
      capacity,
      ac: ac === 'true',
      itinerary: itineraryArray,
      inclusions: inclusionsArray,
      price: Number(price),
      duration,
      image: req.file.filename
    });
    
    const newPackage = await package.save();
    res.status(201).json(newPackage);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});

// Delete package
router.delete('/:id', async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }
    
    // Delete image file
    const imagePath = path.join(__dirname, '../uploads', package.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    await Package.findByIdAndDelete(req.params.id);
    res.json({ message: 'Package deleted successfully' });
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