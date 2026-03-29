/**
 * SMCar.mn Cache Service
 * Файл: backend/src/services/cacheService.js
 * Үүрэг: 24 цагт нэг удаа apicars.info API-с мэдээлэл татаж MongoDB-д хадгалах
 *
 * Хэрхэн ажилладаг вэ?
 * 1. Сервер эхлэхэд нэг удаа cache шинэчлэнэ
 * 2. Цааш нь 24 цаг тутам автоматаар шинэчлэгдэнэ (setInterval)
 * 3. Хэрэглэгч хуудас нээхэд cache-с өгнө — API дуудахгүй
 * 4. Cache дуусвал (24 цаг өнгөрвөл) автоматаар шинэчлэнэ
 */

const VehicleCache = require('../models/VehicleCache');
const axios = require('axios');

const APICARS_BASE = 'https://apicars.info/api';
const APICARS_KEY = process.env.APICARS_API_KEY || 'cbf43d28797551703928b870bd361f72';

// ============================================================
// apicars.info клиент
// ============================================================
const apiCarsClient = axios.create({
  baseURL: APICARS_BASE,
  headers: { 'X-API-Key': APICARS_KEY },
  timeout: 30000,
});

// ============================================================
// HELPER: price → жинхэнэ KRW (만원 × 10,000)
// ============================================================
const toKRW = (price) => {
  if (!price) return 0;
  const num = Number(price);
  if (isNaN(num)) return 0;
  return num < 1000000 ? Math.round(num * 10000) : Math.round(num);
};

// ============================================================
// HELPER: Түлшний нэрийг монголчлах
// ============================================================
const FUEL_MN = {
  gasoline: 'Бензин',
  diesel: 'Дизель',
  electric: 'Цахилгаан',
  hybrid: 'Хосолмол (Гибрид)',
  lpg: 'Шингэрүүлсэн хий',
  gas: 'Шингэрүүлсэн хий',
  hev: 'Хосолмол (Гибрид)',
  phev: 'Залгадаг хосолмол',
  ev: 'Цахилгаан',
  hydrogen: 'Устөрөгч',
  '가솔린': 'Бензин',
  '디젤': 'Дизель',
  '전기': 'Цахилгаан',
  '하이브리드': 'Хосолмол (Гибрид)',
  '수소': 'Устөрөгч',
  'lpi': 'Шингэрүүлсэн хий',
};

const normalizeFuelMN = (fuel) => {
  if (!fuel) return 'Бензин';
  const key = fuel.toLowerCase().trim();
  return FUEL_MN[key] || FUEL_MN[Object.keys(FUEL_MN).find(k => key.includes(k))] || 'Бензин';
};

// ============================================================
// HELPER: Engine CC parse
// ============================================================
const MODEL_CC_MAP = {
  'casper': 1000, 'venue': 1600, 'avante': 1600, 'i30': 1600,
  'kona': 1600, 'tucson': 2000, 'santa fe': 2500, 'santafe': 2500,
  'palisade': 2200, 'staria': 3500, 'porter': 2500,
  'grandeur': 2500, 'sonata': 2000,
  'ioniq5': 0, 'ioniq6': 0, 'ioniq9': 0, 'ioniq': 1600,
  'ray': 1000, 'morning': 1000, 'picanto': 1000,
  'k3': 1600, 'k5': 2000, 'k8': 2500, 'k9': 3300,
  'seltos': 1600, 'sportage': 2000, 'sorento': 2200,
  'mohave': 3000, 'carnival': 3500, 'stonic': 1000,
  'niro': 1600, 'ev6': 0, 'ev9': 0,
  'g70': 2000, 'g80': 2500, 'g90': 3300,
  'gv70': 2500, 'gv80': 2500,
};

const parseEngineCC = (car) => {
  const direct = car.engineSize || car.engine_size || car.displacement || car.engineCC;
  if (direct && Number(direct) > 100) return Number(direct);

  const title = (car.title || '').toLowerCase();
  const model = (car.model || '').toLowerCase();
  const brand = (car.brand || car.manufacturer || '').toLowerCase();

  const matchLiter = title.match(/\b(\d+\.\d+)\s*[lt]?\b/i);
  if (matchLiter) {
    const cc = Math.round(parseFloat(matchLiter[1]) * 1000);
    if (cc >= 600 && cc <= 8000) return cc;
  }

  const fullName = brand + ' ' + model + ' ' + title;
  for (const [key, cc] of Object.entries(MODEL_CC_MAP)) {
    if (fullName.includes(key)) return cc;
  }

  return 0;
};

// ============================================================
// HELPER: Response-с машинуудыг гаргах
// ============================================================
const extractCars = (responseData) => {
  if (!responseData) return { cars: [], total: 0 };
  const inner = responseData.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    if (inner.cars && Array.isArray(inner.cars)) {
      return { cars: inner.cars, total: inner.pagination?.total || inner.total || inner.cars.length };
    }
  }
  if (Array.isArray(responseData)) return { cars: responseData, total: responseData.length };
  if (Array.isArray(responseData.data)) return { cars: responseData.data, total: responseData.total || responseData.data.length };
  return { cars: [], total: 0 };
};

// ============================================================
// HELPER: Машиныг стандарт форматад хөрвүүлэх
// ============================================================
const formatVehicle = (car) => {
  if (!car) return null;

  let photos = [];
  if (Array.isArray(car.images) && car.images.length) photos = car.images;
  else if (Array.isArray(car.photos) && car.photos.length) photos = car.photos;
  else if (car.image) photos = [car.image];
  else if (car.imageUrl) photos = [car.imageUrl];
  photos = photos.filter(Boolean);

  const priceKRW = toKRW(car.price || car.priceKRW || car.Price || 0);
  const displacement = parseEngineCC(car);
  const fuelRaw = car.fuelType || car.fuel_type || car.fuel || '';
  const fuelMN = normalizeFuelMN(fuelRaw);

  return {
    id: String(car.id || car._id || ''),
    manufacturer: car.brand || car.manufacturer || car.make || '',
    model: car.model || '',
    grade: car.trim || car.grade || car.version || '',
    modelGroup: car.model || '',
    year: Number(car.year) || null,
    mileage: Number(car.mileage || car.km || 0),
    fuel: fuelMN,
    fuelType: fuelMN,
    fuelRaw: fuelRaw,
    displacement,
    priceKRW,
    priceDisplay: `₩${priceKRW.toLocaleString('ko-KR')}`,
    photos,
    firstPhoto: photos[0] || null,
    secondPhoto: photos[1] || null,
    color: car.color || car.colour || '',
    transmission: car.transmission || car.gearbox || '',
    officeCityState: car.location || car.city || '',
    title: car.title || `${car.brand || ''} ${car.model || ''}`.trim(),
    cachedAt: new Date().toISOString(),
    source: 'apicars',
  };
};

// ============================================================
// БРЭНДИЙН ЖАГСААЛТ — cache-тай
// ============================================================
const POPULAR_BRANDS = [
  'Hyundai', 'Kia', 'Genesis', 'BMW', 'Mercedes-Benz',
  'Audi', 'Volkswagen', 'Chevrolet', 'Renault', 'Mini',
  'Land Rover', 'Volvo', 'Porsche', 'Toyota', 'Lexus',
  'Honda', 'Nissan', 'Ford', 'Jeep',
];

/**
 * Нэг брэндийн машинуудыг API-с татах
 */
const fetchBrandVehicles = async (brand, limit = 20) => {
  try {
    const res = await apiCarsClient.get('/cars', {
      params: { brand, limit, page: 1, sortBy: 'year', sortOrder: 'desc' },
    });
    const { cars, total } = extractCars(res.data);
    const vehicles = cars.map(formatVehicle).filter(Boolean);
    return { vehicles, total };
  } catch (err) {
    console.warn(`⚠️  ${brand} татаж чадсангүй: ${err.message}`);
    return { vehicles: [], total: 0 };
  }
};

/**
 * Брэндийн загваруудыг татах
 */
const fetchBrandModels = async (brand) => {
  try {
    const res = await apiCarsClient.get('/cars', {
      params: { brand, limit: 100, page: 1 },
    });
    const { cars } = extractCars(res.data);
    const modelCounts = {};
    cars.forEach(c => {
      const m = c.model;
      if (m) modelCounts[m] = (modelCounts[m] || 0) + 1;
    });
    return Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  } catch {
    return [];
  }
};

// ============================================================
// ҮНДСЭН CACHE ШИНЭЧЛЭХ ФУНКЦ
// ============================================================

/**
 * Бүх ерөнхий мэдээллийг API-с татаж MongoDB-д хадгалах
 * Энэ функц 24 цаг тутамд ажиллана
 */
const refreshAllCache = async () => {
  const startTime = Date.now();
  console.log('');
  console.log('🔄 Cache шинэчлэж эхэлж байна...');
  console.log(`   Цаг: ${new Date().toLocaleString('mn-MN')}`);
  console.log('='.repeat(50));

  let success = 0;
  let failed = 0;

  try {
    // 1. Ерөнхий жагсаалт (нүүр хуудасны default)
    console.log('📥 Ерөнхий машин жагсаалт татаж байна...');
    try {
      const res = await apiCarsClient.get('/cars', {
        params: { limit: 20, page: 1, sortBy: 'year', sortOrder: 'desc' },
      });
      const { cars, total } = extractCars(res.data);
      const vehicles = cars.map(formatVehicle).filter(Boolean);
      await VehicleCache.setCache('general_listing', { vehicles }, 'listing', total);
      console.log(`   ✅ Ерөнхий жагсаалт: ${vehicles.length} машин (Нийт: ${total})`);
      success++;
    } catch (err) {
      console.error(`   ❌ Ерөнхий жагсаалт: ${err.message}`);
      failed++;
    }

    // Хэт олон request явуулахгүйн тулд 1 секунд хүлээх
    await new Promise(r => setTimeout(r, 1000));

    // 2. Брэнд бүрийн машинууд + загварын тоо
    console.log(`\n📥 ${POPULAR_BRANDS.length} брэндийн мэдээлэл татаж байна...`);

    const brandStats = {};

    for (const brand of POPULAR_BRANDS) {
      try {
        const [vehicleData, models] = await Promise.all([
          fetchBrandVehicles(brand, 20),
          fetchBrandModels(brand),
        ]);

        brandStats[brand] = {
          total: vehicleData.total,
          models: models.slice(0, 10), // Top 10 загвар
          topVehicles: vehicleData.vehicles.slice(0, 8),
        };

        // Брэнд бүрийн cache хадгалах
        await VehicleCache.setCache(
          `brand_${brand.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          {
            vehicles: vehicleData.vehicles,
            models,
            total: vehicleData.total,
          },
          'listing',
          vehicleData.total
        );

        console.log(`   ✅ ${brand}: ${vehicleData.total} машин, ${models.length} загвар`);
        success++;

        // Rate limit-с зайлсхийх — 800ms хүлээх
        await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        console.error(`   ❌ ${brand}: ${err.message}`);
        failed++;
      }
    }

    // 3. Брэндийн статистик нэгтгэж хадгалах
    await VehicleCache.setCache('brand_stats', brandStats, 'stats', 0);
    console.log(`\n✅ Брэндийн статистик хадгалагдлаа`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('');
    console.log('='.repeat(50));
    console.log(`🎉 Cache шинэчлэлт дууслаа!`);
    console.log(`   ✅ Амжилттай: ${success} | ❌ Алдаа: ${failed}`);
    console.log(`   ⏱️  Нийт хугацаа: ${elapsed} секунд`);
    console.log(`   ⏰ Дараагийн шинэчлэлт: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('mn-MN')}`);
    console.log('='.repeat(50));

  } catch (err) {
    console.error('❌ Cache шинэчлэлтэд алдаа гарлаа:', err.message);
  }
};

// ============================================================
// ТОДОРХОЙ БРЭНДИЙН CACHE АВАХ
// ============================================================
const getBrandCache = async (brand) => {
  const key = `brand_${brand.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const cached = await VehicleCache.getCache(key);
  return cached ? cached.data : null;
};

// ============================================================
// БРЭНДИЙН СТАТИСТИК АВАХ
// ============================================================
const getBrandStats = async () => {
  const cached = await VehicleCache.getCache('brand_stats');
  return cached ? cached.data : null;
};

// ============================================================
// ЕРӨНХИЙ ЖАГСААЛТ АВАХ
// ============================================================
const getGeneralListing = async () => {
  const cached = await VehicleCache.getCache('general_listing');
  return cached ? cached.data : null;
};

// ============================================================
// 24 ЦАГТ НЭГ УДАА АВТОМАТААР ШИНЭЧЛЭХ
// ============================================================
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

let refreshTimer = null;

/**
 * Cache scheduler эхлүүлэх
 * server.js-д нэг удаа дуудана
 */
const startCacheScheduler = async () => {
  console.log('');
  console.log('⏰ Cache scheduler эхэлж байна...');

  // Эхлэхдээ cache байгаа эсэхийг шалгах
  const existingCache = await VehicleCache.getCache('general_listing');

  if (!existingCache) {
    console.log('   📭 Cache хоосон байна, шинэчлэж эхэлж байна...');
    // Блоклохгүйн тулд background-д ажиллуулна
    refreshAllCache().catch(console.error);
  } else {
    console.log('   ✅ Cache байна, дараагийн шинэчлэлтийг хүлээж байна');
    console.log(`   📅 Cache дуусах хугацаа: ${existingCache.expiresAt?.toLocaleString?.('mn-MN') || 'Тодорхойгүй'}`);
  }

  // 24 цаг тутамд дахин татах
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    console.log('\n⏰ 24 цаг болж, cache автоматаар шинэчлэгдэж байна...');
    refreshAllCache().catch(console.error);
  }, TWENTY_FOUR_HOURS);

  console.log('   🔄 24 цаг тутам автоматаар шинэчлэгдэнэ');
};

/**
 * Scheduler зогсоох (graceful shutdown)
 */
const stopCacheScheduler = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.log('⏹️  Cache scheduler зогсоолоо');
  }
};

/**
 * Хүчээр шинэчлэх (admin endpoint-аас)
 */
const forceRefresh = async () => {
  console.log('🔥 Cache хүчээр шинэчлэж байна...');
  await VehicleCache.clearAll();
  await refreshAllCache();
};

module.exports = {
  startCacheScheduler,
  stopCacheScheduler,
  forceRefresh,
  refreshAllCache,
  getBrandCache,
  getBrandStats,
  getGeneralListing,
  normalizeFuelMN,
  formatVehicle,
  extractCars,
  toKRW,
};