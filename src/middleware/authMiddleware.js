/**
 * SMCar.mn Auth Middleware
 * Файл: backend/src/middleware/authMiddleware.js
 * Үүрэг: Admin JWT token шалгах middleware
 * Admin шаардлагатай бүх route-д энэ middleware хэрэглэнэ
 */

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  let token;

  // Authorization header-аас token авах
  // Format: "Bearer eyJhbGciOi..."
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    console.warn(`⚠️  Auth алдаа: Token байхгүй - ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      message: 'Нэвтрэх шаардлагатай. Token байхгүй байна.',
    });
  }

  try {
    // Token-ийг шалгах
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Admin мэдээлэл авах
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      console.warn(`⚠️  Auth алдаа: Admin олдсонгүй - ID: ${decoded.id}`);
      return res.status(401).json({
        success: false,
        message: 'Admin олдсонгүй. Дахин нэвтэрнэ үү.',
      });
    }

    if (!admin.isActive) {
      console.warn(`⚠️  Auth алдаа: Admin идэвхгүй - ${admin.email}`);
      return res.status(401).json({
        success: false,
        message: 'Таны бүртгэл идэвхгүй болсон байна.',
      });
    }

    // req.admin-д admin мэдээлэл хадгалах
    req.admin = admin;
    console.log(`✅ Auth амжилттай: ${admin.email} - ${req.method} ${req.originalUrl}`);
    next();

  } catch (error) {
    console.error(`❌ Auth алдаа: ${error.message} - ${req.method} ${req.originalUrl}`);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token буруу байна. Дахин нэвтэрнэ үү.',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token хугацаа дууссан. Дахин нэвтэрнэ үү.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Нэвтрэх эрхгүй байна.',
    });
  }
};

module.exports = { protect };