/**
 * SMCar.mn Cache Service
 * Файл: backend/src/services/cacheService.js
 * Үүрэг: 24 цагт нэг удаа apicars.info API-с мэдээлэл татаж MongoDB-д хадгалах
 */

const VehicleCache = require('../models/VehicleCache');
const axios = require('axios');

const APICARS_BASE = 'https://apicars.info/api';
const APICARS_KEY = process.env.APICARS_API_KEY || 'cbf43d28797551703928b870bd361f72';

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
  gasoline:     'Бензин',
  petrol:       'Бензин',
  '가솔린':      'Бензин',
  diesel:       'Дизель',
  '디젤':        'Дизель',
  electric:     'Цахилгаан',
  ev:           'Цахилгаан',
  '전기':        'Цахилгаан',
  hybrid:       'Хосолмол',
  hev:          'Хосолмол',
  phev:         'Хосолмол',
  '하이브리드':  'Хосолмол',
  lpg:          'Шингэрүүлсэн хий',
  lpi:          'Шингэрүүлсэн хий',
  gas:          'Шингэрүүлсэн хий',
  '가스':        'Шингэрүүлсэн хий',
  hydrogen:     'Устөрөгч',
  '수소':        'Устөрөгч',
};

const normalizeFuelMN = (fuel) => {
  if (!fuel) return 'Бензин';
  const key = fuel.toLowerCase().trim();

  // Шууд тохирох утга байвал буцаах
  if (FUEL_MN[key]) return FUEL_MN[key];

  // Агуулсан байвал хайх
  if (key.includes('diesel') || key.includes('дизел')) return 'Дизель';
  if (key.includes('electric') || key.includes('цахилгаан') || key === 'ev') return 'Цахилгаан';
  if (key.includes('hybrid') || key.includes('хибрид') || key.includes('хосолмол')) return 'Хосолмол';
  if (key.includes('lpg') || key.includes('lpi') || key.includes('шингэрүүлсэн')) return 'Шингэрүүлсэн хий';
  if (key.includes('hydrogen') || key.includes('устөрөгч')) return 'Устөрөгч';
  if (key.includes('gasoline') || key.includes('бензин') || key.includes('petrol')) return 'Бензин';

  return 'Бензин';
};

// ============================================================
// HELPER: Engine CC parse
// ============================================================
const MODEL_CC_MAP = {
  // Hyundai
  'casper': 1000, 'venue': 1600, 'avante': 1600, 'i30': 1600,
  'kona': 1600, 'tucson': 2000, 'santa fe': 2500, 'santafe': 2500,
  'palisade': 2200, 'staria': 3500, 'porter': 2500,
  'grandeur': 2500, 'sonata': 2000,
  'ioniq5': 0, 'ioniq6': 0, 'ioniq9': 0, 'ioniq': 1600,
  // Kia
  'ray': 1000, 'morning': 1000, 'picanto': 1000,
  'k3': 1600, 'k5': 2000, 'k8': 2500, 'k9': 3300,
  'seltos': 1600, 'sportage': 2000, 'sorento': 2200,
  'mohave': 3000, 'carnival': 3500, 'stonic': 1000,
  'niro': 1600, 'ev6': 0, 'ev9': 0,
  // Genesis
  'g70': 2000, 'g80': 2500, 'g90': 3300,
  'gv70': 2500, 'gv80': 2500, 'gv60': 0,
  // BMW
  'x1': 1500, 'x2': 1500, 'x3': 2000, 'x4': 2000,
  'x5': 3000, 'x6': 3000, 'x7': 3000,
  // Mercedes-Benz
  'glb': 1500, 'glc': 2000, 'gle': 3000, 'gls': 3000,
  'cla': 1500, 'cls': 3000,
  // Audi
  'a3': 1400, 'a4': 2000, 'a5': 2000, 'a6': 2000,
  'a7': 2000, 'a8': 3000, 'q3': 1400, 'q5': 2000,
  'q7': 3000, 'q8': 3000,
  // Lexus
  'ux': 2000, 'nx': 2500, 'rx': 3500, 'lx': 3500,
  'es': 2500, 'is': 2000, 'ls': 3500,
  // Land Rover
  'range rover sport': 3000, 'range rover velar': 2000,
  'range rover evoque': 2000, 'range rover': 3000,
  'defender': 3000, 'discovery sport': 2000, 'discovery': 3000,
  'freelander': 2000,
  // Volvo
  'xc90': 2000, 'xc60': 2000, 'xc40': 1500,
  's90': 2000, 's60': 2000, 'v90': 2000, 'v60': 2000,
  // Porsche
  'cayenne': 3000, 'macan': 2000, 'panamera': 3000,
  'taycan': 0, 'cayman': 2500, 'boxster': 2500, '911': 3000,
  // Mini
  'cooper': 1500, 'countryman': 2000, 'clubman': 1500,
  // Tesla
  'model 3': 0, 'model s': 0, 'model x': 0, 'model y': 0,
  // Chevrolet
  'malibu': 1500, 'trax': 1400, 'equinox': 1500, 'spark': 1000,
  // Toyota
  'camry': 2500, 'corolla': 1600, 'rav4': 2000,
  'highlander': 3500, 'prius': 1800, 'land cruiser': 4000,
  // Jeep
  'wrangler': 3600, 'gladiator': 3600, 'cherokee': 2400,
  'compass': 2400, 'renegade': 1400, 'grand cherokee': 3600,
};

const parseEngineCC = (car) => {
  const direct = car.engineSize || car.engine_size || car.displacement || car.engineCC;
  if (direct && Number(direct) > 100) return Number(direct);

  const title = (car.title || '').toLowerCase();
  const model = (car.model || '').toLowerCase();
  const brand = (car.brand || car.manufacturer || '').toLowerCase();
  const fullName = (brand + ' ' + model + ' ' + title).toLowerCase();

  // P530, P400 гэх Land Rover нэршил
  const pMatch = title.match(/\bp(\d)(\d{2})\b/i);
  if (pMatch) {
    const cc = parseInt(pMatch[1] + pMatch[2]) * 100;
    if (cc >= 600 && cc <= 8000) return cc;
  }

  // "2.2L", "1.6T" гэх мэт
  const matchLiter = title.match(/\b(\d+\.\d+)\s*[lt]?\b/i);
  if (matchLiter) {
    const cc = Math.round(parseFloat(matchLiter[1]) * 1000);
    if (cc >= 600 && cc <= 8000) return cc;
  }

  // Урт нэрийг эхэлж шалга
  const sortedKeys = Object.keys(MODEL_CC_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (fullName.includes(key)) return MODEL_CC_MAP[key];
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
    fuelRaw,
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
// БРЭНДИЙН ЖАГСААЛТ
// ============================================================
const POPULAR_BRANDS = [
  'Hyundai', 'Kia', 'Genesis', 'BMW', 'Mercedes-Benz',
  'Audi', 'Volkswagen', 'Chevrolet', 'Renault', 'Mini',
  'Land Rover', 'Volvo', 'Porsche', 'Toyota', 'Lexus',
  'Honda', 'Nissan', 'Ford', 'Jeep',
];

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
const refreshAllCache = async () => {
  const startTime = Date.now();
  console.log('');
  console.log('🔄 Cache шинэчлэж эхэлж байна...');
  console.log(`   Цаг: ${new Date().toLocaleString('mn-MN')}`);
  console.log('='.repeat(50));

  let success = 0;
  let failed = 0;

  try {
    // 1. Ерөнхий жагсаалт
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

    await new Promise(r => setTimeout(r, 1000));

    // 2. Брэнд бүрийн машинууд
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
          models: models.slice(0, 10),
          topVehicles: vehicleData.vehicles.slice(0, 8),
        };

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

        await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        console.error(`   ❌ ${brand}: ${err.message}`);
        failed++;
      }
    }

    // 3. Брэндийн статистик
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
// CACHE АВАХ ФУНКЦУУД
// ============================================================
const getBrandCache = async (brand) => {
  const key = `brand_${brand.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const cached = await VehicleCache.getCache(key);
  return cached ? cached.data : null;
};

const getBrandStats = async () => {
  const cached = await VehicleCache.getCache('brand_stats');
  return cached ? cached.data : null;
};

const getGeneralListing = async () => {
  const cached = await VehicleCache.getCache('general_listing');
  return cached ? cached.data : null;
};

// ============================================================
// 24 ЦАГТ НЭГ УДАА АВТОМАТААР ШИНЭЧЛЭХ
// ============================================================
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
let refreshTimer = null;

const startCacheScheduler = async () => {
  console.log('');
  console.log('⏰ Cache scheduler эхэлж байна...');

  const existingCache = await VehicleCache.getCache('general_listing');

  if (!existingCache) {
    console.log('   📭 Cache хоосон байна, шинэчлэж эхэлж байна...');
    refreshAllCache().catch(console.error);
  } else {
    console.log('   ✅ Cache байна, дараагийн шинэчлэлтийг хүлээж байна');
    console.log(`   📅 Cache дуусах хугацаа: ${existingCache.expiresAt?.toLocaleString?.('mn-MN') || 'Тодорхойгүй'}`);
  }

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    console.log('\n⏰ 24 цаг болж, cache автоматаар шинэчлэгдэж байна...');
    refreshAllCache().catch(console.error);
  }, TWENTY_FOUR_HOURS);

  console.log('   🔄 24 цаг тутам автоматаар шинэчлэгдэнэ');
};

const stopCacheScheduler = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.log('⏹️  Cache scheduler зогсоолоо');
  }
};

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