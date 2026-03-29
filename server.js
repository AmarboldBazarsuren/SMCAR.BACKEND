/**
 * SMCar.mn Backend Server
 * Файл: backend/server.js
 *
 * Өөрчлөлт: Cache scheduler нэмэгдлээ
 * - MongoDB холбогдсоны дараа cache scheduler эхэлнэ
 * - 24 цаг тутам apicars.info-с мэдээлэл татаж MongoDB-д хадгалдаг
 */

require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const { startCacheScheduler, stopCacheScheduler } = require('./src/services/cacheService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log('🚀 SMCar.mn сервер эхэлж байна...');

    // MongoDB холбох
    await connectDB();

    // Cache scheduler эхлүүлэх
    // MongoDB холбогдсоны ДАРАА эхлүүлэх шаардлагатай
    await startCacheScheduler();

    // Сервер эхлүүлэх
    const server = app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`✅ Сервер амжилттай эхэллээ!`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📋 API Docs: http://localhost:${PORT}/api`);
      console.log(`🗄️  Cache: MongoDB-д 24 цаг тутам шинэчлэгдэнэ`);
      console.log('='.repeat(50));
    });

    // Graceful shutdown — сервер зогсоход scheduler-г цэвэрлэх
    const shutdown = (signal) => {
      console.log(`\n${signal} хүлээн авлаа. Сервер зогсож байна...`);
      stopCacheScheduler();
      server.close(() => {
        console.log('👋 Сервер зогслоо');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Сервер эхлэхэд алдаа гарлаа:');
    console.error(`   Алдаа: ${error.message}`);
    process.exit(1);
  }
};

startServer();