const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  vehicleType: {
    type: String,
    required: true
  },
  capacity: {
    type: String,
    required: true
  },
  ac: {
    type: Boolean,
    default: true
  },
  itinerary: [{
    day: String,
    description: String
  }],
  inclusions: [String],
  price: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Package', packageSchema);