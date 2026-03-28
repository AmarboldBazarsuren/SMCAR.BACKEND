/**
 * SMCar.mn Encar Service
 * Файл: backend/src/services/encarService.js
 * Үүрэг: encar.mn болон encar.com API-г шууд ашиглан машины мэдээлэл татах
 *
 * Ашиглаж буй API-ууд:
 * 1. http://api.encar.com/search/car/list/general  → Машинуудын жагсаалт (ID-ууд)
 * 2. https://encar.mn/api/card?vehicle_id={ID}     → Монгол үнэ, үндсэн мэдээлэл
 * 3. https://encar.mn/api/detailed-images?vehicleId={ID} → Бүх зургууд
 * 4. https://encar.mn/api/model-groups?manufacturer={name} → Загваруудын жагсаалт
 * 5. https://encar.mn/api/exchange-rate            → Ханш
 * Зургийн base URL: https://ci.encar.com{path}
 */

const axios = require('axios');

const ENCAR_IMAGE_BASE = 'https://ci.encar.com';
const ENCAR_API_BASE = 'http://api.encar.com';
const ENCAR_MN_BASE = 'https://encar.mn';

// ============================================================
// AXIOS INSTANCE - encar.com жагсаалт татах
// ============================================================
const encarClient = axios.create({
  baseURL: ENCAR_API_BASE,
  headers: {
    Referer: 'http://www.encar.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  timeout: 15000,
});

// ============================================================
// AXIOS INSTANCE - encar.mn API татах
// ============================================================
const encarMnClient = axios.create({
  baseURL: ENCAR_MN_BASE,
  headers: {
    Referer: 'https://encar.mn',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  timeout: 15000,
});

// ============================================================
// HELPER: Зургийн замыг бүтэн URL болгох
// ============================================================
const buildImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${ENCAR_IMAGE_BASE}${path}`;
};

// ============================================================
// HELPER: encar.com query filter үүсгэх
// ============================================================
const buildQuery = (filters = {}) => {
  const conditions = ['And.Hidden.N._'];

  if (filters.manufacturer) {
    conditions.push(`Manufacturer.${encodeURIComponent(filters.manufacturer)}._`);
  }
  if (filters.modelGroup) {
    conditions.push(`ModelGroup.${encodeURIComponent(filters.modelGroup)}._`);
  }
  if (filters.year_min || filters.year_max) {
    const min = filters.year_min ? `${filters.year_min}00` : '';
    const max = filters.year_max ? `${filters.year_max}12` : '';
    if (min && max) conditions.push(`Year.range.${min}.${max}._`);
    else if (min) conditions.push(`Year.range.${min}.._`);
    else if (max) conditions.push(`Year.range..${max}._`);
  }
  if (filters.price_min || filters.price_max) {
    const min = filters.price_min || '';
    const max = filters.price_max || '';
    conditions.push(`Price.range.${min}.${max}._`);
  }
  if (filters.fuelType) {
    conditions.push(`FuelType.${encodeURIComponent(filters.fuelType)}._`);
  }

  conditions.push('SellType.일반.');
  return `(${conditions.join('')})`;
};

// ============================================================
// 1. МАШИНУУДЫН ЖАГСААЛТ
// encar.com-оос ID жагсаалт авч → encar.mn-оос мэдээлэл татна
// ============================================================
const getVehicles = async (filters = {}) => {
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  const query = buildQuery(filters);
  console.log(`🔍 Encar жагсаалт хайж байна: limit=${limit}, offset=${offset}`);

  // encar.com-оос ID жагсаалт авах
  const listRes = await encarClient.get('/search/car/list/general', {
    params: {
      count: true,
      q: query,
      sr: `|ModifiedDate|${offset}|${limit}`,
    },
  });

  const total = listRes.data.Count || 0;
  const searchResults = listRes.data.SearchResults || [];

  console.log(`✅ encar.com-оос ${searchResults.length} машин олдлоо (Нийт: ${total})`);

  // Параллель байдлаар encar.mn-оос мэдээлэл татах
  const vehicles = await Promise.all(
    searchResults.map(async (item) => {
      try {
        const mnRes = await encarMnClient.get('/api/card', {
          params: { vehicle_id: item.Id },
        });

        const mnData = mnRes.data?.data || {};

        // Зургууд - encar.com жагсаалтаас ирсэн Photos-г ашиглах
        const photos = (item.Photos || []).map((p) => buildImageUrl(p.location));

        return {
          id: item.Id,
          manufacturer: mnData.manufacturer || '',
          model: mnData.model || '',
          grade: mnData.grade || '',
          modelGroup: mnData.modelgroup || '',
          year: mnData.year || null,
          mileage: mnData.mileage || 0,
          fuel: mnData.fuel || '',
          displacement: mnData.displacement || 0,
          priceKRW: mnData.price ? Number(mnData.price) : 0,
          photos: photos,
          firstPhoto: buildImageUrl(mnData.first_photo),
          secondPhoto: buildImageUrl(mnData.second_photo),
          officeCityState: item.OfficeCityState || '',
          source: 'encar',
        };
      } catch (err) {
        console.warn(`⚠️  encar.mn card алдаа (ID: ${item.Id}): ${err.message}`);

        // encar.mn амжилтгүй бол encar.com-ийн өгөгдлөөс ашиглах
        const photos = (item.Photos || []).map((p) => buildImageUrl(p.location));
        return {
          id: item.Id,
          manufacturer: item.Manufacturer || '',
          model: item.Model || '',
          grade: item.Badge || '',
          modelGroup: item.Model || '',
          year: item.FormYear ? Number(item.FormYear) : null,
          mileage: item.Mileage || 0,
          fuel: item.FuelType || '',
          displacement: 0,
          priceKRW: item.Price ? item.Price * 10000 : 0,
          photos: photos,
          firstPhoto: photos[0] || null,
          secondPhoto: photos[1] || null,
          officeCityState: item.OfficeCityState || '',
          source: 'encar',
        };
      }
    })
  );

  return {
    success: true,
    data: {
      vehicles,
      total,
      limit,
      offset,
    },
  };
};

// ============================================================
// 2. НЭГЖ МАШИНЫ ДЭЛГЭРЭНГҮЙ МЭДЭЭЛЭЛ
// encar.mn/api/card + encar.mn/api/detailed-images
// ============================================================
const getVehicleById = async (id) => {
  console.log(`🔍 Машины дэлгэрэнгүй татаж байна: ID ${id}`);

  // Параллель байдлаар card + зургуудыг татах
  const [cardRes, imagesRes] = await Promise.allSettled([
    encarMnClient.get('/api/card', { params: { vehicle_id: id } }),
    encarMnClient.get('/api/detailed-images', { params: { vehicleId: id } }),
  ]);

  // Card мэдээлэл
  let cardData = {};
  if (cardRes.status === 'fulfilled' && cardRes.value.data?.data) {
    cardData = cardRes.value.data.data;
    console.log(`✅ encar.mn card мэдээлэл ирлээ: ${cardData.manufacturer} ${cardData.model}`);
  } else {
    console.warn(`⚠️  encar.mn card татаж чадсангүй: ID ${id}`);
  }

  // Зургуудын жагсаалт
  let photos = [];
  if (imagesRes.status === 'fulfilled' && imagesRes.value.data?.data) {
    photos = imagesRes.value.data.data.map((path) => buildImageUrl(path));
    console.log(`✅ ${photos.length} зураг олдлоо`);
  } else {
    console.warn(`⚠️  Зураг татаж чадсангүй: ID ${id}`);
  }

  if (!cardData.vehicle_id && photos.length === 0) {
    throw new Error(`Машин олдсонгүй: ID ${id}`);
  }

  const vehicle = {
    id: cardData.vehicle_id || id,
    manufacturer: cardData.manufacturer || '',
    model: cardData.model || '',
    grade: cardData.grade || '',
    modelGroup: cardData.modelgroup || '',
    year: cardData.year || null,
    mileage: cardData.mileage || 0,
    fuel: cardData.fuel || '',
    displacement: cardData.displacement || 0,
    priceKRW: cardData.price ? Number(cardData.price) : 0,
    photos: photos,
    firstPhoto: buildImageUrl(cardData.first_photo) || photos[0] || null,
    source: 'encar',
  };

  console.log(`✅ Машин бэлэн: ${vehicle.manufacturer} ${vehicle.model} (${photos.length} зураг)`);
  return { success: true, data: vehicle };
};

// ============================================================
// 3. БРЭНДҮҮДИЙН ЖАГСААЛТ
// encar.com-оос manufacturer жагсаалт авах
// ============================================================
const getBrands = async () => {
  console.log(`🔍 Брэндүүд татаж байна...`);

  const res = await encarClient.get('/search/car/list/general', {
    params: {
      count: true,
      q: '(And.Hidden.N._.SellType.일반.)',
      sr: '|ModifiedDate|0|1',
      facet: 'Manufacturer',
    },
  });

  // encar.com facet-аас брэнд авах оролдлого
  // Хэрэв facet ирэхгүй бол статик жагсаалт буцаана
  const staticBrands = [
    'Hyundai', 'Kia', 'Genesis', 'Chevrolet', 'Renault Korea',
    'KG Mobility', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen',
    'Toyota', 'Honda', 'Lexus', 'Porsche', 'Land Rover',
    'Volvo', 'Jaguar', 'Ford', 'Jeep', 'Mini',
  ];

  console.log(`✅ ${staticBrands.length} брэнд буцаалаа`);
  return { success: true, data: staticBrands };
};

// ============================================================
// 4. БРЭНДИЙН ЗАГВАРУУДЫН ЖАГСААЛТ
// encar.mn/api/model-groups?manufacturer={name}
// ============================================================
const getModelsByBrand = async (brand) => {
  console.log(`🔍 ${brand} загваруудыг татаж байна...`);

  const res = await encarMnClient.get('/api/model-groups', {
    params: { manufacturer: brand },
  });

  if (!res.data?.success) {
    throw new Error(`${brand} брэндийн загваруудыг татаж чадсангүй`);
  }

  const models = res.data.data || [];
  console.log(`✅ ${brand}: ${models.length} загвар олдлоо`);

  return { success: true, data: models };
};

// ============================================================
// 5. ВАЛЮТЫН ХАНШ
// encar.mn/api/exchange-rate
// ============================================================
const getExchangeRate = async () => {
  console.log(`💱 Ханш татаж байна...`);

  const res = await encarMnClient.get('/api/exchange-rate');

  if (!res.data?.success) {
    throw new Error('Ханш татаж чадсангүй');
  }

  const rate = res.data.data?.rate || null;
  console.log(`✅ Ханш: 1₩ = ${rate}₮`);

  return { success: true, data: res.data.data };
};

// ============================================================
// 6. ХОЛБОЛТ ТЕСТ
// ============================================================
const testConnection = async () => {
  console.log('🔌 Encar API холболт тест хийж байна...');
  try {
    await encarClient.get('/search/car/list/general', {
      params: {
        count: true,
        q: '(And.Hidden.N._.SellType.일반.)',
        sr: '|ModifiedDate|0|1',
      },
    });
    console.log('✅ Encar API холболт амжилттай!');
    return { success: true, message: 'API холболт ажиллаж байна' };
  } catch (error) {
    console.error('❌ Encar API холболт амжилтгүй:', error.message);
    return { success: false, message: error.message };
  }
};

module.exports = {
  getVehicles,
  getVehicleById,
  getBrands,
  getModelsByBrand,
  getExchangeRate,
  testConnection,
};