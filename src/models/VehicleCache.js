/**
 * SMCar.mn VehicleCache Model
 * Файл: backend/src/models/VehicleCache.js
 * Үүрэг: apicars.info API-с татсан машинуудыг MongoDB-д cache хийх
 *
 * Яагаад хэрэгтэй вэ?
 * - apicars.info API-д хязгаартай request явуулж болно (rate limit)
 * - Хэрэглэгч хуудас шинэчлэх бүрт API дуудалгүйгээр cache-с өгнө
 * - 24 цагт нэг удаа л шинэчлэгдэнэ → зардал хэмнэнэ
 * - Машин мэдэгдэл 24 цагийн хугацаанд тогтвортой харагдана
 */

const mongoose = require('mongoose');

const vehicleCacheSchema = new mongoose.Schema(
  {
    // Cache-ийн түлхүүр — хайлтын параметрүүдээс үүснэ
    // Жишээ: "brand=Kia&limit=20&page=1" эсвэл "vehicle_id_12345"
    cacheKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Cache-ийн төрөл
    cacheType: {
      type: String,
      enum: ['listing', 'detail', 'brands', 'models', 'stats'],
      default: 'listing',
    },

    // Хадгалсан өгөгдөл (JSON)
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Нийт машины тоо (listing cache-д хэрэгтэй)
    total: {
      type: Number,
      default: 0,
    },

    // Cache үүссэн цаг
    createdAt: {
      type: Date,
      default: Date.now,
    },

    // Cache дуусах цаг (24 цаг)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 цаг
      index: { expireAfterSeconds: 0 }, // MongoDB TTL index — автоматаар устгана
    },

    // Хэдэн удаа ашиглагдсан (статистик)
    hitCount: {
      type: Number,
      default: 0,
    },

    // Сүүлд ашиглагдсан цаг
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // timestamps: false — createdAt-г өөрсдөө удирдана
    timestamps: false,
  }
);

// ============================================================
// STATIC METHODS
// ============================================================

/**
 * Cache-с өгөгдөл авах
 * Хугацаа дуусаагүй бол буцаана, дууссан бол null
 */
vehicleCacheSchema.statics.getCache = async function (cacheKey) {
  const now = new Date();
  const entry = await this.findOne({
    cacheKey,
    expiresAt: { $gt: now }, // Дуусаагүй cache л авна
  });

  if (entry) {
    // Hit count нэмэгдүүлэх (await хийхгүй — гүйцэтгэлд нөлөөлөхгүй байх)
    this.updateOne({ cacheKey }, {
      $inc: { hitCount: 1 },
      $set: { lastAccessedAt: now },
    }).catch(() => {});

    console.log(`📦 Cache HIT: ${cacheKey} (${entry.hitCount + 1} удаа ашиглагдсан)`);
    return entry;
  }

  console.log(`💨 Cache MISS: ${cacheKey}`);
  return null;
};

/**
 * Cache-д өгөгдөл хадгалах
 * Байгаа бол шинэчлэх (upsert)
 */
vehicleCacheSchema.statics.setCache = async function (cacheKey, data, cacheType = 'listing', total = 0) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 цаг

  await this.findOneAndUpdate(
    { cacheKey },
    {
      cacheKey,
      cacheType,
      data,
      total,
      expiresAt,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      hitCount: 0,
    },
    { upsert: true, new: true }
  );

  console.log(`💾 Cache SET: ${cacheKey} (${expiresAt.toLocaleString()} хүртэл хадгалагдана)`);
};

/**
 * Тодорхой cache устгах (шинэчлэх үед хэрэгтэй)
 */
vehicleCacheSchema.statics.invalidate = async function (pattern) {
  const result = await this.deleteMany({
    cacheKey: { $regex: pattern, $options: 'i' },
  });
  console.log(`🗑️  Cache invalidated: ${pattern} (${result.deletedCount} устгалаа)`);
  return result.deletedCount;
};

/**
 * Бүх cache устгах (хүчээр шинэчлэх үед)
 */
vehicleCacheSchema.statics.clearAll = async function () {
  const result = await this.deleteMany({});
  console.log(`🗑️  Бүх cache устгалаа: ${result.deletedCount} entry`);
  return result.deletedCount;
};

/**
 * Cache статистик
 */
vehicleCacheSchema.statics.getStats = async function () {
  const now = new Date();
  const [total, active, expired] = await Promise.all([
    this.countDocuments({}),
    this.countDocuments({ expiresAt: { $gt: now } }),
    this.countDocuments({ expiresAt: { $lte: now } }),
  ]);
  return { total, active, expired };
};

const VehicleCache = mongoose.model('VehicleCache', vehicleCacheSchema);

module.exports = VehicleCache;