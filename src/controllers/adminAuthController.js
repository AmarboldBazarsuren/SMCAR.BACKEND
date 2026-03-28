/**
 * SMCar.mn Admin Auth Controller
 * Файл: backend/src/controllers/adminAuthController.js
 * Үүрэг: Admin нэвтрэх, гарах, мэдээлэл авах
 * Routes: POST /api/admin/auth/login, GET /api/admin/auth/me
 */

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/**
 * JWT token үүсгэх helper функц
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ============================================================
// POST /api/admin/auth/login - Admin нэвтрэх
// ============================================================
const login = async (req, res) => {
  const { email, password } = req.body;

  console.log(`🔐 Admin нэвтрэх оролдлого: ${email}`);

  // Validation
  if (!email || !password) {
    console.warn('⚠️  Login: И-мэйл эсвэл нууц үг дутуу');
    return res.status(400).json({
      success: false,
      message: 'И-мэйл болон нууц үгийг оруулна уу',
    });
  }

  try {
    // Admin хайх (нууц үгийг explicitly select хийх)
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin) {
      console.warn(`⚠️  Login: Admin олдсонгүй - ${email}`);
      return res.status(401).json({
        success: false,
        message: 'И-мэйл эсвэл нууц үг буруу байна',
      });
    }

    // Нууц үг шалгах
    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      console.warn(`⚠️  Login: Нууц үг буруу - ${email}`);
      return res.status(401).json({
        success: false,
        message: 'И-мэйл эсвэл нууц үг буруу байна',
      });
    }

    if (!admin.isActive) {
      console.warn(`⚠️  Login: Admin идэвхгүй - ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Таны бүртгэл идэвхгүй болсон байна. Холбоо барина уу.',
      });
    }

    // Сүүлийн нэвтрэлтийг шинэчлэх
    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    // Token үүсгэх
    const token = generateToken(admin._id);

    console.log(`✅ Admin амжилттай нэвтэрлээ: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Амжилттай нэвтэрлээ',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error(`❌ Login алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Серверийн алдаа гарлаа. Дараа дахин оролдоорой.',
    });
  }
};

// ============================================================
// GET /api/admin/auth/me - Одоогийн admin мэдээлэл авах
// ============================================================
const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error(`❌ GetMe алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Admin мэдээлэл татаж чадсангүй',
    });
  }
};

// ============================================================
// PUT /api/admin/auth/change-password - Нууц үг солих
// ============================================================
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Одоогийн болон шинэ нууц үгийг оруулна уу',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой',
    });
  }

  try {
    const admin = await Admin.findById(req.admin._id).select('+password');

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Одоогийн нууц үг буруу байна',
      });
    }

    admin.password = newPassword;
    await admin.save();

    console.log(`✅ Admin нууц үг солилоо: ${admin.email}`);
    res.status(200).json({
      success: true,
      message: 'Нууц үг амжилттай солигдлоо',
    });
  } catch (error) {
    console.error(`❌ ChangePassword алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Нууц үг солиход алдаа гарлаа',
    });
  }
};

module.exports = { login, getMe, changePassword };