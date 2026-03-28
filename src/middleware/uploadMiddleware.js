/**
 * SMCar.mn Upload Middleware
 * Файл: backend/src/middleware/uploadMiddleware.js
 * Үүрэг: Banner болон машины зураг upload хийх multer тохиргоо
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOAD } = require('../config/constants');

// Upload фолдер байгаа эсэхийг шалгаж, байхгүй бол үүсгэх
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Upload фолдер үүсгэлээ: ${dir}`);
  }
};

// ============================================================
// BANNER UPLOAD тохиргоо
// ============================================================
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../', UPLOAD.BANNER_FOLDER);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `banner_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

// ============================================================
// VEHICLE UPLOAD тохиргоо
// ============================================================
const vehicleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../', UPLOAD.VEHICLE_FOLDER);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `vehicle_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

// ============================================================
// FILE FILTER - Зөвхөн зураг зөвшөөрөх
// ============================================================
const imageFilter = (req, file, cb) => {
  if (UPLOAD.ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.warn(`⚠️  Upload: Зөвшөөрөгдөөгүй файл төрөл - ${file.mimetype}`);
    cb(new Error(`Зөвхөн зураг файл зөвшөөрөгдөнө: ${UPLOAD.ALLOWED_TYPES.join(', ')}`), false);
  }
};

// ============================================================
// MULTER INSTANCE-УУД
// ============================================================

// Banner upload - нэг banner нэг зураг
const uploadBanner = multer({
  storage: bannerStorage,
  fileFilter: imageFilter,
  limits: { fileSize: UPLOAD.MAX_SIZE },
}).single('image');

// Vehicle upload - нэг машин олон зураг (max 10)
const uploadVehicleImages = multer({
  storage: vehicleStorage,
  fileFilter: imageFilter,
  limits: { fileSize: UPLOAD.MAX_SIZE },
}).array('images', 10);

// ============================================================
// WRAPPER FUNCTION - Алдааг зохицуулж middleware болгох
// ============================================================
const handleUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error(`❌ Multer алдаа: ${err.message}`);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `Файлын хэмжээ хэтэрсэн. Хамгийн ихдээ ${UPLOAD.MAX_SIZE / 1024 / 1024}MB байна.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload алдаа: ${err.message}`,
      });
    }

    if (err) {
      console.error(`❌ Upload алдаа: ${err.message}`);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    next();
  });
};

module.exports = {
  uploadBanner: handleUpload(uploadBanner),
  uploadVehicleImages: handleUpload(uploadVehicleImages),
};