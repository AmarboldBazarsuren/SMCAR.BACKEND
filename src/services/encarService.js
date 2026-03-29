/**
 * SMCar.mn Vehicle Service
 * Файл: backend/src/services/encarService.js
 * API: apicars.info
 * 
 * Чухал анхаарлууд:
 *  - price field: "만원" нэгжтэй (×10,000 = жинхэнэ KRW)
 *  - currency: "KRW" гэж байгаа ч жинхэнэ KRW биш, 만원
 *  - engineSize field байхгүй тул title-аас parse хийнэ
 *  - Response бүтэц: { success, data: { cars: [...], pagination: {...} } }
 */

const axios = require('axios');

const APICARS_BASE = 'https://apicars.info/api';
const APICARS_KEY = 'cbf43d28797551703928b870bd361f72';

// 5 минутын cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const getCached = (key) => {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.time > CACHE_TTL) { cache.delete(key); return null; }
  return e.data;
};
const setCache = (key, data) => cache.set(key, { data, time: Date.now() });

const apiCarsClient = axios.create({
  baseURL: APICARS_BASE,
  headers: { 'X-API-Key': APICARS_KEY },
  timeout: 20000,
});

// ============================================================
// HELPER: price-г жинхэнэ KRW болгох
// apicars.info price нь 만원 нэгжтэй (÷10,000 хийгдсэн)
// Жишээ: 5950 → 59,500,000 KRW
// ============================================================
const toKRW = (price) => {
  if (!price) return 0;
  return Math.round(Number(price) * 10000);
};

// ============================================================
// HELPER: title-аас engine displacement parse хийх
// Жишээ: "Kia Sorento Diesel 2.2 4WD" → 2200
// Жишээ: "BMW 320i" → 2000 (model-аас)
// ============================================================
const parseEngineCC = (car) => {
  // 1. engineSize, displacement гэх мэт field байвал эхлэж шалгах
  const direct = car.engineSize || car.engine_size || car.displacement || car.engineCC || car.engine;
  if (direct && Number(direct) > 100) return Number(direct);

  // 2. title-аас "2.2", "1.6", "2.0" гэх хэлбэрийг хайх
  const title = car.title || `${car.brand || ''} ${car.model || ''}`;
  const matchFloat = title.match(/\b(\d+\.\d+)\b/);
  if (matchFloat) return Math.round(parseFloat(matchFloat[1]) * 1000);

  // 3. model code-оос тооцоолох: "320i"→2000, "E250"→2500, "G80"→0
  const model = car.model || '';
  const matchModel = model.match(/(\d{3})[iId]?$/);
  if (matchModel) {
    const cc = parseInt(matchModel[1]) * 10;
    if (cc >= 500 && cc <= 9000) return cc;
  }

  return 0;
};

// ============================================================
// HELPER: Response-оос машинуудын массив гаргах
// Бүтэц: { success: true, data: { cars: [...], pagination: {...} } }
// ============================================================
const extractCars = (responseData) => {
  if (!responseData) return { cars: [], total: 0 };
  if (Array.isArray(responseData)) return { cars: responseData, total: responseData.length };

  // { success, data: { cars: [...], pagination: { total } } }
  const inner = responseData.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    if (inner.cars && Array.isArray(inner.cars)) {
      const total = inner.pagination?.total || inner.total || inner.totalCount || inner.cars.length;
      return { cars: inner.cars, total };
    }
    if (Array.isArray(inner)) return { cars: inner, total: inner.length };
  }
  if (Array.isArray(responseData.data)) return { cars: responseData.data, total: responseData.total || responseData.data.length };
  if (responseData.cars) return { cars: responseData.cars, total: responseData.total || responseData.cars.length };

  console.warn('⚠️  extractCars: бүтэц танигдсангүй', JSON.stringify(responseData).substring(0, 200));
  return { cars: [], total: 0 };
};

// ============================================================
// HELPER: Машин форматлах
// ============================================================
const formatVehicle = (car) => {
  if (!car) return null;

  // Зурагнууд
  let photos = [];
  if (Array.isArray(car.images) && car.images.length) photos = car.images;
  else if (Array.isArray(car.photos) && car.photos.length) photos = car.photos;
  else if (car.image) photos = [car.image];
  else if (car.imageUrl) photos = [car.imageUrl];
  else if (car.thumbnail) photos = [car.thumbnail];

  // Үнэ: 만원 → KRW
  const priceKRW = toKRW(car.price || car.priceKRW || car.Price || 0);

  // Хөдөлгүүрийн хэмжээ
  const displacement = parseEngineCC(car);

  return {
    id: String(car.id || car._id || ''),
    manufacturer: car.brand || car.manufacturer || car.make || '',
    model: car.model || '',
    grade: car.trim || car.grade || car.version || '',
    modelGroup: car.model || '',
    year: car.year || null,
    mileage: car.mileage || car.km || 0,
    fuel: car.fuelType || car.fuel_type || car.fuel || '',
    displacement,
    priceKRW,
    priceDisplay: `₩${priceKRW.toLocaleString('ko-KR')}`,
    photos,
    firstPhoto: photos[0] || null,
    secondPhoto: photos[1] || null,
    color: car.color || car.colour || '',
    transmission: car.transmission || car.gearbox || '',
    officeCityState: car.location || car.city || car.country || '',
    title: car.title || `${car.brand || ''} ${car.model || ''}`.trim(),
    source: 'apicars',
  };
};

// ============================================================
// 1. МАШИНУУДЫН ЖАГСААЛТ
// ============================================================
const getVehicles = async (filters = {}) => {
  const limit = Number(filters.limit) || 20;
  const offset = Number(filters.offset) || 0;
  const page = Math.floor(offset / limit) + 1;

  const params = {
    page, limit,
    sortBy: filters.sortBy || 'year',
    sortOrder: filters.sortOrder || 'desc',
  };

  if (filters.manufacturer) params.brand = filters.manufacturer;
  if (filters.modelGroup) params.model = filters.modelGroup;
  else if (filters.model) params.model = filters.model;
  if (filters.year_min) params.yearFrom = filters.year_min;
  if (filters.year_max) params.yearTo = filters.year_max;
  if (filters.fuelType) {
    const fuelMap = { '가솔린': 'Gasoline', '디젤': 'Diesel', '전기': 'Electric', '하이브리드': 'Hybrid' };
    params.fuelType = fuelMap[filters.fuelType] || filters.fuelType;
  }

  const cacheKey = JSON.stringify(params);
  const cached = getCached(cacheKey);
  if (cached) { console.log(`📦 Cache hit`); return cached; }

  console.log(`🔍 apicars.info:`, params);

  try {
    const res = await apiCarsClient.get('/cars', { params });
    const { cars, total } = extractCars(res.data);
    console.log(`✅ ${cars.length} машин (Нийт: ${total})`);

    const vehicles = cars.map(formatVehicle).filter(Boolean);
    const result = { success: true, data: { vehicles, total, limit, offset } };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    if (err.response?.status === 429) throw new Error('API rate limit хэтэрлээ.');
    throw new Error(`apicars.info алдаа: ${err.message}`);
  }
};

// ============================================================
// 2. НЭГЖ МАШИН
// ============================================================
const getVehicleById = async (id) => {
  const cacheKey = `vehicle_${id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  console.log(`🔍 Машин дэлгэрэнгүй: ID ${id}`);
  try {
    const res = await apiCarsClient.get(`/cars/${id}`);

    // Нэгж машины response: { success, data: { ...car } } эсвэл { success, data: { car: {...} } }
    let raw = null;
    const d = res.data?.data;
    if (d && typeof d === 'object') {
      if (d.id || d._id) raw = d;           // data өөрөө машин
      else if (d.car) raw = d.car;          // data.car машин
    }
    if (!raw) raw = res.data;

    if (!raw || !raw.id) throw new Error(`Машин олдсонгүй: ID ${id}`);

    const vehicle = formatVehicle(raw);
    console.log(`✅ ${vehicle.manufacturer} ${vehicle.model} | ₩${vehicle.priceKRW.toLocaleString()} | ${vehicle.displacement}cc | ${vehicle.photos.length} зураг`);

    const result = { success: true, data: vehicle };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`❌ дэлгэрэнгүй алдаа: ${err.message}`);
    throw err;
  }
};

// ============================================================
// 3. БРЭНДҮҮД
// ============================================================
const getBrands = async () => {
  const brands = [
    'Hyundai', 'Kia', 'Genesis', 'BMW', 'Mercedes-Benz',
    'Audi', 'Volkswagen', 'Toyota', 'Honda', 'Lexus',
    'Mazda', 'Nissan', 'Ford', 'Jeep', 'Land Rover',
    'Volvo', 'Porsche', 'Mini', 'Chevrolet', 'Renault',
    'Peugeot', 'Skoda', 'Seat', 'Fiat', 'Tesla', 'Opel',
  ];
  return { success: true, data: [...new Set(brands)] };
};

// ============================================================
// 4. БРЭНДИЙН ЗАГВАРУУД
// ============================================================
const getModelsByBrand = async (brand) => {
  const cacheKey = `models_${brand}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await apiCarsClient.get('/cars', { params: { brand, limit: 500 } });
    const { cars } = extractCars(res.data);
    const models = [...new Set(cars.map(c => c.model).filter(Boolean))].sort();
    const result = { success: true, data: models };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    return { success: true, data: [] };
  }
};

// ============================================================
// 5. ХАНШ
// ============================================================
const getExchangeRate = async () => ({
  success: true,
  data: { rate: 1, from: 'KRW', to: 'KRW', note: 'apicars.info KRW (만원×10000) ашиглана' },
});

// ============================================================
// 6. ТЕСТ
// ============================================================
const testConnection = async () => {
  try {
    const res = await apiCarsClient.get('/cars', { params: { limit: 1 } });
    const { cars, total } = extractCars(res.data);
    if (cars.length > 0) {
      const sample = cars[0];
      console.log('🔬 Sample car:', JSON.stringify(sample).substring(0, 300));
    }
    return { success: true, message: `apicars.info ажиллаж байна. Нийт: ${total}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = { getVehicles, getVehicleById, getBrands, getModelsByBrand, getExchangeRate, testConnection };