/**
 * SMCar.mn Admin Vehicle Controller
 * Файл: backend/src/controllers/adminVehicleController.js
 * Үүрэг: Admin panel-аас гараар машин нэмэх, засах, устгах
 * Routes: /api/admin/vehicles
 */

const fs = require('fs');
const path = require('path');
const ManualVehicle = require('../models/ManualVehicle');
const { calculateTotalPrice } = require('../services/taxService');

/**
 * Зургийн URL үүсгэх
 */
const getFileUrl = (req, filePath) => {
  const relativePath = filePath.replace(/\\/g, '/').split('uploads/')[1];
  return `${req.protocol}://${req.get('host')}/uploads/${relativePath}`;
};

// ============================================================
// GET /api/admin/vehicles - Бүх гараар нэмсэн машин авах
// ============================================================
const getAllManualVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 20, brand, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (brand) filter.brand = new RegExp(brand, 'i');
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    console.log(`📋 Admin: Гараар нэмсэн машинууд (page ${page}, limit ${limit})`);

    const [vehicles, total] = await Promise.all([
      ManualVehicle.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ManualVehicle.countDocuments(filter),
    ]);

    console.log(`✅ ${vehicles.length} машин олдлоо (Нийт: ${total})`);

    res.status(200).json({
      success: true,
      count: vehicles.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: vehicles,
    });
  } catch (error) {
    console.error(`❌ GetAllManualVehicles алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Машинуудын жагсаалт татаж чадсангүй',
    });
  }
};

// ============================================================
// GET /api/admin/vehicles/:id - Нэг машины дэлгэрэнгүй
// ============================================================
const getManualVehicleById = async (req, res) => {
  try {
    const vehicle = await ManualVehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Машин олдсонгүй',
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error(`❌ GetManualVehicleById алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Машины мэдээлэл татаж чадсангүй',
    });
  }
};

// ============================================================
// POST /api/admin/vehicles - Шинэ машин нэмэх
// ============================================================
const createManualVehicle = async (req, res) => {
  console.log('🚗 Шинэ машин нэмж байна...');
  console.log('   Мэдээлэл:', req.body);

  const {
    title, brand, model, year, mileage, engineCC,
    fuelType, transmission, color, priceKRW,
    description, features, location, encarUrl, encarId,
  } = req.body;

  // Validation
  if (!title || !brand || !model || !year || !engineCC || !priceKRW) {
    // Upload хийсэн файлуудыг устгах
    if (req.files) {
      req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    }
    return res.status(400).json({
      success: false,
      message: 'Гарчиг, брэнд, загвар, он, хөдөлгүүр, үнэ заавал шаардлагатай',
    });
  }

  try {
    // Зурагнуудыг боловсруулах
    const images = (req.files || []).map((file) => ({
      url: getFileUrl(req, file.path),
      path: file.path,
      alt: title,
    }));

    console.log(`   ${images.length} зураг upload хийгдлээ`);

    // Татвар тооцоолох
    let totalPriceMNT = 0;
    try {
      const taxResult = await calculateTotalPrice({
        priceKRW: Number(priceKRW),
        year: Number(year),
        engineCC: Number(engineCC),
      });
      totalPriceMNT = taxResult.totalPriceMNT;
      console.log(`   Нийт үнэ MNT: ₮${totalPriceMNT.toLocaleString()}`);
    } catch (taxErr) {
      console.warn(`⚠️  Татвар тооцоолоход алдаа: ${taxErr.message} - Нийт дүн 0 болно`);
    }

    const vehicle = await ManualVehicle.create({
      title,
      brand,
      model,
      year: Number(year),
      mileage: mileage ? Number(mileage) : 0,
      engineCC: Number(engineCC),
      fuelType: fuelType || 'Gasoline',
      transmission: transmission || 'Automatic',
      color: color || '',
      priceKRW: Number(priceKRW),
      totalPriceMNT,
      images,
      description: description || '',
      features: features ? (Array.isArray(features) ? features : features.split(',').map(f => f.trim())) : [],
      location: location || 'Seoul',
      encarUrl: encarUrl || null,
      encarId: encarId || null,
      isActive: true,
      source: 'manual',
    });

    console.log(`✅ Машин амжилттай нэмэгдлээ: ${vehicle.title} (ID: ${vehicle._id})`);

    res.status(201).json({
      success: true,
      message: 'Машин амжилттай нэмэгдлээ',
      data: vehicle,
    });
  } catch (error) {
    if (req.files) {
      req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    }
    console.error(`❌ CreateManualVehicle алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Машин нэмэхэд алдаа гарлаа',
    });
  }
};

// ============================================================
// PUT /api/admin/vehicles/:id - Машин засах
// ============================================================
const updateManualVehicle = async (req, res) => {
  const { id } = req.params;
  console.log(`✏️  Машин засаж байна: ID ${id}`);

  try {
    const vehicle = await ManualVehicle.findById(id);

    if (!vehicle) {
      if (req.files) req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    const fields = ['title','brand','model','year','mileage','engineCC',
      'fuelType','transmission','color','priceKRW','description',
      'location','encarUrl','encarId','isActive'];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (['year','mileage','engineCC','priceKRW'].includes(field)) {
          vehicle[field] = Number(req.body[field]);
        } else if (field === 'isActive') {
          vehicle[field] = req.body[field] === 'true' || req.body[field] === true;
        } else {
          vehicle[field] = req.body[field];
        }
      }
    });

    if (req.body.features) {
      vehicle.features = Array.isArray(req.body.features)
        ? req.body.features
        : req.body.features.split(',').map(f => f.trim());
    }

    // Шинэ зургууд нэмэх
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: getFileUrl(req, file.path),
        path: file.path,
        alt: vehicle.title,
      }));
      vehicle.images = [...vehicle.images, ...newImages];
      console.log(`   ${req.files.length} шинэ зураг нэмэгдлээ`);
    }

    // Татвар дахин тооцоолох
    if (req.body.priceKRW || req.body.year || req.body.engineCC) {
      try {
        const taxResult = await calculateTotalPrice({
          priceKRW: vehicle.priceKRW,
          year: vehicle.year,
          engineCC: vehicle.engineCC,
        });
        vehicle.totalPriceMNT = taxResult.totalPriceMNT;
        console.log(`   Дахин тооцоолсон нийт үнэ: ₮${vehicle.totalPriceMNT.toLocaleString()}`);
      } catch (taxErr) {
        console.warn(`⚠️  Татвар дахин тооцоолоход алдаа: ${taxErr.message}`);
      }
    }

    await vehicle.save();
    console.log(`✅ Машин шинэчлэгдлээ: ${vehicle.title}`);

    res.status(200).json({
      success: true,
      message: 'Машин амжилттай шинэчлэгдлээ',
      data: vehicle,
    });
  } catch (error) {
    if (req.files) req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    console.error(`❌ UpdateManualVehicle алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Машин шинэчлэхэд алдаа гарлаа' });
  }
};

// ============================================================
// DELETE /api/admin/vehicles/:id - Машин устгах
// ============================================================
const deleteManualVehicle = async (req, res) => {
  const { id } = req.params;
  console.log(`🗑️  Машин устгаж байна: ID ${id}`);

  try {
    const vehicle = await ManualVehicle.findById(id);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    // Зурагнуудыг устгах
    vehicle.images.forEach(img => {
      if (img.path && fs.existsSync(img.path)) {
        fs.unlinkSync(img.path);
        console.log(`   Зураг устгалаа: ${img.path}`);
      }
    });

    await vehicle.deleteOne();
    console.log(`✅ Машин устгалаа: ${vehicle.title}`);

    res.status(200).json({ success: true, message: 'Машин амжилттай устгалаа' });
  } catch (error) {
    console.error(`❌ DeleteManualVehicle алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Машин устгахад алдаа гарлаа' });
  }
};

// ============================================================
// DELETE /api/admin/vehicles/:id/images/:imageId - Зураг устгах
// ============================================================
const deleteVehicleImage = async (req, res) => {
  const { id, imageId } = req.params;

  try {
    const vehicle = await ManualVehicle.findById(id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });

    const imgIndex = vehicle.images.findIndex(img => img._id.toString() === imageId);
    if (imgIndex === -1) return res.status(404).json({ success: false, message: 'Зураг олдсонгүй' });

    const img = vehicle.images[imgIndex];
    if (img.path && fs.existsSync(img.path)) {
      fs.unlinkSync(img.path);
    }

    vehicle.images.splice(imgIndex, 1);
    await vehicle.save();

    console.log(`✅ Зураг устгалаа: ${imageId}`);
    res.status(200).json({ success: true, message: 'Зураг устгалаа', data: vehicle });
  } catch (error) {
    console.error(`❌ DeleteVehicleImage алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Зураг устгахад алдаа гарлаа' });
  }
};

module.exports = {
  getAllManualVehicles,
  getManualVehicleById,
  createManualVehicle,
  updateManualVehicle,
  deleteManualVehicle,
  deleteVehicleImage,
};