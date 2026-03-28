/**
 * SMCar.mn Express App
 * Файл: backend/src/app.js
 * Үүрэг: Express app тохиргоо, middleware, route бүртгэл
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const routes = require('./routes/index');

const app = express();

// ============================================================
// MIDDLEWARE - Хүсэлт боловсруулах дундын программ
// ============================================================

// CORS - Frontend-аас хүсэлт зөвшөөрөх
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001', // dev үед нэмэлт port
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// JSON body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger - development үед request-уудыг console дээр харуулна
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log('📝 HTTP request logging идэвхжүүлсэн (development mode)');
}

// Static files - Upload хийсэн зургуудыг public болгох
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
console.log(`📁 Static files: /uploads -> ${path.join(__dirname, '../uploads')}`);

// ============================================================
// ROUTES - API endpoint-ууд
// ============================================================
app.use('/api', routes);

// Root endpoint - API ажиллаж байгаа эсэхийг шалгах
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚗 SMCar.mn API ажиллаж байна!',
    version: '1.0.0',
    endpoints: {
      public: '/api/vehicles - Нийтийн машинуудын жагсаалт',
      admin: '/api/admin - Admin panel API',
      health: '/api/health - Системийн байдал',
    },
  });
});

// ============================================================
// ERROR HANDLERS - Алдаа зохицуулах
// ============================================================

// 404 - Олдоогүй endpoint
app.use((req, res, next) => {
  console.warn(`⚠️  404: Олдоогүй endpoint - ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Endpoint олдсонгүй: ${req.method} ${req.originalUrl}`,
  });
});

// 500 - Серверийн алдаа
app.use((err, req, res, next) => {
  console.error('❌ Серверийн алдаа:');
  console.error(`   URL: ${req.method} ${req.originalUrl}`);
  console.error(`   Алдаа: ${err.message}`);
  console.error(`   Stack: ${err.stack}`);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Серверийн дотоод алдаа гарлаа',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;