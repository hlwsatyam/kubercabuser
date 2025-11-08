const multer = require('multer');
const path = require('path');

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(req, file, cb)
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
        console.log(req, file, cb)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  console.log(req, file, cb)
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
    fileSize: 5 * 1024 * 1024  
  }
});














// module.exports = ;






















































const storageForChat = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(file)
    let folder = 'uploads/';
    
    if (file.mimetype.startsWith('image/')) {
      folder += 'images/';
    } else if (file.mimetype.startsWith('audio/')) {
      folder += 'audio/';
    } else if (file.mimetype.startsWith('video/')) {
      folder += 'videos/';
    } else {
      folder += 'documents/';
    }
    
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilterForChat = (req, file, cb) => {
  console.log(file)
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
    'audio/mpeg', 'audio/wav', 'audio/mp3',
    'video/mp4', 'video/quicktime','audio/m4a',
    'application/pdf', 'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};
 
const uploadChat = multer({
  storage: storageForChat,
  fileFilter: fileFilterForChat,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Multiple upload configurations
const uploadImage = uploadChat.single('image');
const uploadAudio = uploadChat.single('audio');
const uploadVideo = uploadChat.single('video');
const uploadDocument = uploadChat.single('document');

module.exports = {
  uploadImage,upload,
  uploadAudio,
  uploadVideo,
  uploadDocument,
  uploadMultiple: uploadChat.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'document', maxCount: 1 }
  ])
};








