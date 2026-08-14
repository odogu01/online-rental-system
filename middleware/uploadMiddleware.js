const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_PATH = process.env.UPLOAD_PATH || 'public/uploads';

const ALLOWED_IMAGE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

fs.mkdirSync(path.resolve(UPLOAD_PATH), { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(UPLOAD_PATH)),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_IMAGE_TYPES[ext] === file.mimetype;
  if (!(ext in ALLOWED_IMAGE_TYPES) || !mimeOk) {
    const err = new Error('Only image files (jpg, jpeg, png, webp, gif) are allowed');
    err.name = 'FileTypeError';
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadSingle = upload.single('image');

module.exports = { upload, uploadSingle, UPLOAD_PATH };