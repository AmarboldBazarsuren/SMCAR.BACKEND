/**
 * SMCar.mn MongoDB холболт
 * Файл: backend/src/config/database.js
 * Үүрэг: MongoDB-тэй холбогдох, холболтын байдлыг мониторинг хийх
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI .env файлд тохируулагдаагүй байна!');
    console.error('💡 Шийдэл: .env файлд MONGODB_URI=mongodb://localhost:27017/smcar гэж нэмнэ үү');
    process.exit(1);
  }

  console.log(`🔌 MongoDB холбогдож байна: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);

  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      // MongoDB 6+ дээр эдгээр option шаардлагагүй ч явуулбал алдаа гарахгүй
    });

    console.log(`✅ MongoDB амжилттай холбогдлоо!`);
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);

    // Холболт тасарвал console дээр харуулах
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB холболт тасарлаа! Дахин холбогдож байна...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB дахин холбогдлоо!');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB алдаа:', err.message);
    });

  } catch (error) {
    console.error('❌ MongoDB холбогдоход алдаа гарлаа:');
    console.error(`   Алдаа: ${error.message}`);
    console.error('');
    console.error('💡 Боломжит шийдлүүд:');
    console.error('   1. MongoDB ажиллаж байгаа эсэхийг шалгаарай: mongod --version');
    console.error('   2. MongoDB эхлүүлэх: sudo systemctl start mongod');
    console.error('   3. Atlas ашиглаж байгаа бол connection string-ийг шалгаарай');
    throw error;
  }
};

module.exports = connectDB;