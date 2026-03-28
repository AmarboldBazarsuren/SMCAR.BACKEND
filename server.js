/**
 * SMCar.mn Backend Server
 * Файл: backend/server.js
 * Үүрэг: Серверийг эхлүүлэх үндсэн файл
 */

require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');

const PORT = process.env.PORT || 5000;

// MongoDB холболт хийгээд сервер эхлүүл
const startServer = async () => {
  try {
    console.log('🚀 SMCar.mn сервер эхэлж байна...');

    // MongoDB холбох
    await connectDB();

    // Сервер эхлүүл
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`✅ Сервер амжилттай эхэллээ!`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📋 API Docs: http://localhost:${PORT}/api`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('❌ Сервер эхлэхэд алдаа гарлаа:');
    console.error(`   Алдаа: ${error.message}`);
    console.error('💡 Шийдэл: MongoDB ажиллаж байгаа эсэхийг шалгаарай');
    process.exit(1);
  }
};

startServer();