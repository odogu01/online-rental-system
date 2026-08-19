const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Vercel serverless functions have a READ-ONLY filesystem except for /tmp.
// Creating 'public/uploads' at module load time crashes the whole app there
// (ENOENT mkdir '/var/task/public/uploads'), so:
//   - on Vercel, uploads go to the writable OS temp dir
//   - locally, they keep going to public/uploads
// The directory is created lazily (per upload) — never at require() time.
const isServerless = !!process.env.VERCEL;

const UPLOAD_PATH = process.env.UPLOAD_PATH || (
  isServerless
    ? path.join(os.tmpdir(), 'uploads')
    : path.join(__dirname, '..', 'public', 'uploads')
);

const ALLOWED_IMAGE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

// Create the upload directory only when a file is actually being saved.
// Throws if the filesystem refuses (e.g. read-only), which multer surfaces
// as a clean upload error instead of killing the process at boot.
const ensureUploadDir = () => {
  try {
    fs.mkdirSync(UPLOAD_PATH, { recursive: true });
  } catch (err) {
    throw new Error(`Could not create upload directory ${UPLOAD_PATH}: ${err.message}`);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureUploadDir();
      cb(null, UPLOAD_PATH);
    } catch (err) {
      cb(err);
    }
  },
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