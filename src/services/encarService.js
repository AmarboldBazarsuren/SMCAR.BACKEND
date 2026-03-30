/**
 * SMCar.mn Vehicle Service
 * Файл: backend/src/services/encarService.js
 * API: apicars.info
 *
 * ЗАСВАР: toKRW функцийн логик сайжруулагдсан
 * apicars.info-н price нь 만원 (10,000₩) нэгжтэй.
 * Гэхдээ зарим машины price нь буруу байдаг тул
 * detail хуудсанд Encar.com-оос шууд үнэ авна.
 *
 * PRICE НЭГЖ:
 * - apicars.info price field → 만원 нэгж (× 10,000 = KRW)
 * - Жишээ: price=3729 → 37,290,000₩
 * - Энэ нь Encar.com-н үнэтэй ойролцоо боловч зөрүү гарч болно
 *
 * Response бүтэц:
 * { success: true, data: { cars: [...], pagination: {...} } }
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
  console.log(`📦 Cache: ${key}`);
  return e.data;
};
const setCache = (key, data) => cache.set(key, { data, time: Date.now() });

const apiCarsClient = axios.create({
  baseURL: APICARS_BASE,
  headers: { 'X-API-Key': APICARS_KEY },
  timeout: 20000,
});

// ============================================================
// HELPER: price → жинхэнэ KRW
//
// apicars.info-н price field нь 만원 нэгжтэй:
// - price=3729 → 3729 × 10,000 = 37,290,000₩
//
// Validation:
// - price < 100,000 → 만원 гэж үзнэ (× 10,000)
// - price >= 100,000,000 → аль хэдийн бүрэн KRW (shrug, хэрэглэгдэхгүй)
// - 100,000 <= price < 100,000,000 → шууд KRW (аль хэдийн хөрвүүлсэн)
// ============================================================
const toKRW = (price) => {
  if (!price) return 0;
  const num = Number(price);
  if (isNaN(num) || num <= 0) return 0;

  // 만원 нэгж (10,000₩ нэгж): price 1-99,999 хооронд байвал
  // Жишэ: 3729만원 = 37,290,000₩
  if (num < 100000) {
    return Math.round(num * 10000);
  }

  // Аль хэдийн бүрэн KRW (rare case)
  return Math.round(num);
};

// ============================================================
// Загварын нэрээр CC хайх хүснэгт
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
  'gle300d': 2000, 'gle350': 3000, 'gle400': 3000, 'gle450': 3000,
  'glb200': 1500, 'glc300': 2000, 'c200': 1500, 'c300': 2000,
  'e200': 1500, 'e300': 2000, 'e400': 3000,
  's350': 3000, 's450': 4000, 's500': 4700,
  'cla': 1500, 'cls': 3000, 'slk': 1800,
  // Audi
  'a3': 1400, 'a4': 2000, 'a5': 2000, 'a6': 2000,
  'a7': 2000, 'a8': 3000, 'q3': 1400, 'q5': 2000,
  'q7': 3000, 'q8': 3000, 'e-tron': 0,
  // Lexus
  'ux': 2000, 'nx': 2500, 'rx': 3500, 'lx': 3500,
  'es': 2500, 'is': 2000, 'ls': 3500, 'ux250h': 2000,
  // Land Rover
  'range rover': 3000, 'range rover sport': 3000,
  'range rover velar': 2000, 'range rover evoque': 2000,
  'defender': 3000, 'discovery': 3000, 'discovery sport': 2000,
  'freelander': 2000,
  // Volvo
  'xc90': 2000, 'xc60': 2000, 'xc40': 1500,
  's90': 2000, 's60': 2000, 'v90': 2000, 'v60': 2000,
  // Porsche
  'cayenne': 3000, 'macan': 2000, 'panamera': 3000,
  'taycan': 0, 'cayman': 2500, 'boxster': 2500, '911': 3000,
  // Mini
  'cooper': 1500, 'countryman': 2000, 'clubman': 1500,
  'paceman': 1500, 'coupe': 1500,
  // Tesla
  'model 3': 0, 'model s': 0, 'model x': 0, 'model y': 0,
  // Chevrolet
  'malibu': 1500, 'trax': 1400, 'equinox': 1500,
  'traverse': 3600, 'spark': 1000, 'cruze': 1400,
  // Toyota
  'camry': 2500, 'corolla': 1600, 'rav4': 2000,
  'highlander': 3500, 'prius': 1800, 'land cruiser': 4000,
  // Honda
  'civic': 1500, 'accord': 2000, 'cr-v': 1500,
  'pilot': 3500, 'hrv': 1500, 'fit': 1300,
  // Jeep
  'wrangler': 3600, 'gladiator': 3600, 'cherokee': 2400,
  'compass': 2400, 'renegade': 1400, 'grand cherokee': 3600,
  // Ford
  'mustang': 5000, 'explorer': 3500, 'f-150': 3500,
  'bronco': 2700, 'ranger': 2300, 'edge': 2000,
  // Renault
  'qm6': 2000, 'sm6': 1600, 'xm3': 1300,
  'arkana': 1300, 'master': 2300,
  // Volkswagen
  'golf': 1400, 'passat': 2000, 'tiguan': 2000,
  'touareg': 3000, 'polo': 1000, 'arteon': 2000,
};

// ============================================================
// HELPER: title / model-оос engine displacement (cc) parse
// ============================================================
const parseEngineCC = (car) => {
  const direct = car.engineSize || car.engine_size || car.displacement
               || car.engineCC || car.engine || car.engineVolume || car.cc;
  if (direct && Number(direct) > 100) return Number(direct);

  const title = (car.title || '').toLowerCase();
  const model = (car.model || '').toLowerCase();
  const brand = (car.brand || car.manufacturer || '').toLowerCase();
  const fullName = (brand + ' ' + model + ' ' + title).toLowerCase();

  const pMatch = title.match(/\bp(\d)(\d{2})\b/i);
  if (pMatch) {
    const cc = parseInt(pMatch[1] + pMatch[2]) * 100;
    if (cc >= 600 && cc <= 8000) return cc;
  }

  const matchLiter = title.match(/\b(\d+\.\d+)\s*[lt]?\b/i);
  if (matchLiter) {
    const cc = Math.round(parseFloat(matchLiter[1]) * 1000);
    if (cc >= 600 && cc <= 8000) return cc;
  }

  const sortedKeys = Object.keys(MODEL_CC_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (fullName.includes(key)) return MODEL_CC_MAP[key];
  }

  const bmwMap = { '1': 1500, '2': 1500, '3': 2000, '4': 2000, '5': 2000, '6': 3000, '7': 3000, '8': 3000 };
  const bmwMatch = model.match(/^(\d)(\d{2})[a-z]?$/i) || title.match(/\b(\d)(\d{2})[a-z]?\b/i);
  if (bmwMatch && bmwMap[bmwMatch[1]]) return bmwMap[bmwMatch[1]];

  const benzMatch = model.match(/^[a-z](\d{3})[a-z]?$/i);
  if (benzMatch) {
    const cc = parseInt(benzMatch[1]);
    if (cc >= 150 && cc <= 600) return cc * 10;
  }

  return 0;
};

// ============================================================
// HELPER: fuelType монгол нэрсээр стандартчилах
// ============================================================
const normalizeFuelType = (fuel) => {
  if (!fuel) return 'Бензин';
  const f = fuel.toLowerCase().trim();

  if (f.includes('diesel') || f.includes('дизел') || f === '디젤') return 'Дизель';
  if (f === 'ev' || f.includes('electric') || f.includes('цахилгаан') || f === '전기') return 'Цахилгаан';
  if (f === 'phev' || f === 'hev' || f.includes('hybrid') || f.includes('хибрид') || f === '하이브리드') return 'Хосолмол';
  if (f.includes('lpg') || f.includes('lpi') || f === '가스' || f.includes('gas')) return 'Шингэрүүлсэн хий';
  if (f.includes('hydrogen') || f === '수소') return 'Устөрөгч';
  if (f.includes('gasoline') || f.includes('бензин') || f === '가솔린' || f === 'petrol') return 'Бензин';

  return 'Бензин';
};

// ============================================================
// HELPER: Response-оос машинуудын массив гаргах
// ============================================================
const extractCars = (responseData) => {
  if (!responseData) return { cars: [], total: 0 };

  const inner = responseData.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    if (inner.cars && Array.isArray(inner.cars)) {
      const total = inner.pagination?.total || inner.total || inner.cars.length;
      return { cars: inner.cars, total };
    }
    if (Array.isArray(inner)) return { cars: inner, total: inner.length };
  }

  if (Array.isArray(responseData)) return { cars: responseData, total: responseData.length };
  if (Array.isArray(responseData.data)) return { cars: responseData.data, total: responseData.total || responseData.data.length };
  if (responseData.cars) return { cars: responseData.cars, total: responseData.total || responseData.cars.length };

  console.warn('⚠️  apicars.info хариуны бүтэц:', Object.keys(responseData));
  return { cars: [], total: 0 };
};

// ============================================================
// HELPER: Нэг машиныг стандарт форматад хөрвүүлэх
// ============================================================
const formatVehicle = (car) => {
  if (!car) return null;

  let photos = [];
  if (Array.isArray(car.images) && car.images.length) photos = car.images;
  else if (Array.isArray(car.photos) && car.photos.length) photos = car.photos;
  else if (car.image) photos = [car.image];
  else if (car.imageUrl) photos = [car.imageUrl];
  else if (car.thumbnail) photos = [car.thumbnail];
  photos = photos.filter(Boolean);

  const priceKRW = toKRW(car.price || car.priceKRW || car.Price || 0);
  const displacement = parseEngineCC(car);
  const fuelType = normalizeFuelType(car.fuelType || car.fuel_type || car.fuel);

  return {
    id: String(car.id || car._id || ''),
    manufacturer: car.brand || car.manufacturer || car.make || '',
    model: car.model || '',
    grade: car.trim || car.grade || car.version || '',
    modelGroup: car.model || '',
    year: Number(car.year) || null,
    mileage: Number(car.mileage || car.km || 0),
    fuel: fuelType,
    fuelType,
    displacement,
    priceKRW,
    priceRaw: car.price || car.Price, // Debug үед ашиглана
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
  if (filters.price_min) params.priceFrom = filters.price_min;
  if (filters.price_max) params.priceTo = filters.price_max;
  if (filters.fuelType) {
    const fuelMap = {
      '가솔린': 'Gasoline', '디젤': 'Diesel',
      '전기': 'Electric', '하이브리드': 'Hybrid',
    };
    params.fuelType = fuelMap[filters.fuelType] || filters.fuelType;
  }

  const cacheKey = JSON.stringify(params);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  console.log(`🔍 apicars.info:`, params);

  try {
    const res = await apiCarsClient.get('/cars', { params });

    if (process.env.NODE_ENV === 'development') {
      const sample = res.data?.data?.cars?.[0];
      if (sample) {
        const priceRaw = sample.price || sample.Price;
        const priceKRW = toKRW(priceRaw);
        console.log(`🔬 Sample price: raw=${priceRaw} → KRW=${priceKRW.toLocaleString()} (${priceRaw}만원)`);
      }
    }

    const { cars, total } = extractCars(res.data);
    console.log(`✅ apicars.info: ${cars.length} машин (Нийт: ${total})`);

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
// 2. НЭГЖ МАШИН (дэлгэрэнгүй)
// ============================================================
const getVehicleById = async (id) => {
  const cacheKey = `vehicle_${id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  console.log(`🔍 Машин дэлгэрэнгүй: ID ${id}`);
  try {
    const res = await apiCarsClient.get(`/cars/${id}`);

    let raw = null;
    const d = res.data?.data;
    if (d && typeof d === 'object') {
      if (d.id || d._id) raw = d;
      else if (d.car) raw = d.car;
    }
    if (!raw) raw = res.data;
    if (!raw || (!raw.id && !raw._id)) throw new Error(`Машин олдсонгүй: ID ${id}`);

    const vehicle = formatVehicle(raw);
    console.log(
      `✅ ${vehicle.manufacturer} ${vehicle.model} | raw price=${raw.price || raw.Price} → ₩${vehicle.priceKRW?.toLocaleString()} | ${vehicle.displacement}cc`
    );

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
    const res = await apiCarsClient.get('/cars', { params: { brand, limit: 100 } });
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
  data: {
    note: 'apicars.info price нь 만원 нэгжтэй (×10,000 = жинхэнэ KRW). Detail хуудсанд Encar.com-оос шууд үнэ авна.',
    priceUnit: 'manwon',
    multiplier: 10000,
  },
});

// ============================================================
// 6. ТЕСТ
// ============================================================
const testConnection = async () => {
  try {
    const res = await apiCarsClient.get('/cars', { params: { limit: 1 } });
    const { cars, total } = extractCars(res.data);
    if (cars.length > 0) {
      const s = cars[0];
      const priceRaw = s.price || s.Price;
      const priceKRW = toKRW(priceRaw);
      console.log(`🔬 Sample: ${s.title || s.brand} | raw price=${priceRaw} → ₩${priceKRW.toLocaleString()} (${priceRaw}만원)`);
    }
    return { success: true, message: `apicars.info ажиллаж байна. Нийт: ${total}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = { getVehicles, getVehicleById, getBrands, getModelsByBrand, getExchangeRate, testConnection, toKRW };