const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect( "mongodb+srv://HeySatyam:20172522Satyam@cluster0.xqoozjj.mongodb.net/KubercabUser?retryWrites=true&w=majority&appName=Cluster0", {
      useNewUrlParser: true,
      useUnifiedTopology: true, 
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;