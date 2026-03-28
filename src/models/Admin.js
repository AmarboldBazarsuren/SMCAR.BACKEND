/**
 * SMCar.mn Admin Model
 * Файл: backend/src/models/Admin.js
 * Үүрэг: Admin хэрэглэгчийн MongoDB schema/model
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'И-мэйл заавал шаардлагатай'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Нууц үг заавал шаардлагатай'],
      minlength: [6, 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой'],
      select: false, // Query хийхэд нууц үгийг автоматаар буцааж ирэхгүй
    },
    name: {
      type: String,
      default: 'Admin',
    },
    role: {
      type: String,
      enum: ['admin', 'superadmin'],
      default: 'admin',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt автоматаар нэмнэ
  }
);

// ============================================================
// MIDDLEWARE: Нууц үгийг хадгалахаас өмнө hash хийх
// ============================================================
adminSchema.pre('save', async function (next) {
  // Нууц үг өөрчлөгдөөгүй бол дахин hash хийхгүй
  if (!this.isModified('password')) return next();

  console.log(`🔐 Admin нууц үгийг hash хийж байна: ${this.email}`);
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ============================================================
// METHOD: Нууц үг шалгах
// ============================================================
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;