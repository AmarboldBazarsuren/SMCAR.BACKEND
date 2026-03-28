/**
 * SMCar.mn Admin Banner Controller
 * Файл: backend/src/controllers/adminBannerController.js
 * Үүрэг: Нүүр хуудасны banner зураг нэмэх, засах, устгах
 * Routes: /api/admin/banners
 */

const fs = require('fs');
const path = require('path');
const Banner = require('../models/Banner');

/**
 * Файлын URL үүсгэх helper
 */
const getFileUrl = (req, filePath) => {
  const relativePath = filePath.replace(/\\/g, '/').split('uploads/')[1];
  return `${req.protocol}://${req.get('host')}/uploads/${relativePath}`;
};

// ============================================================
// GET /api/admin/banners - Бүх banner авах
// ============================================================
const getAllBanners = async (req, res) => {
  try {
    console.log('📋 Бүх banner татаж байна...');
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 });

    console.log(`✅ ${banners.length} banner олдлоо`);
    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    console.error(`❌ GetAllBanners алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Banner жагсаалт татаж чадсангүй',
    });
  }
};

// ============================================================
// POST /api/admin/banners - Шинэ banner нэмэх
// Файл upload: multipart/form-data, field нэр: "image"
// ============================================================
const createBanner = async (req, res) => {
  console.log('📸 Шинэ banner үүсгэж байна...');

  if (!req.file) {
    console.warn('⚠️  Banner: Зураг upload хийгдсэнгүй');
    return res.status(400).json({
      success: false,
      message: 'Banner зураг оруулна уу (field нэр: image)',
    });
  }

  const { title, linkUrl, description, order } = req.body;

  if (!title) {
    // Upload хийсэн файлыг устгах
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      message: 'Banner-ийн гарчиг (title) оруулна уу',
    });
  }

  try {
    const imageUrl = getFileUrl(req, req.file.path);
    console.log(`   Зургийн URL: ${imageUrl}`);

    const banner = await Banner.create({
      title,
      imageUrl,
      imagePath: req.file.path,
      linkUrl: linkUrl || null,
      description: description || '',
      order: order ? Number(order) : 0,
      isActive: true,
    });

    console.log(`✅ Banner үүслээ: ${banner.title} (ID: ${banner._id})`);

    res.status(201).json({
      success: true,
      message: 'Banner амжилттай нэмэгдлээ',
      data: banner,
    });
  } catch (error) {
    // Алдаа гарвал upload хийсэн файлыг устгах
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error(`❌ CreateBanner алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Banner нэмэхэд алдаа гарлаа',
    });
  }
};

// ============================================================
// PUT /api/admin/banners/:id - Banner засах
// ============================================================
const updateBanner = async (req, res) => {
  const { id } = req.params;
  const { title, linkUrl, description, order, isActive } = req.body;

  console.log(`✏️  Banner засаж байна: ID ${id}`);

  try {
    const banner = await Banner.findById(id);

    if (!banner) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Banner олдсонгүй',
      });
    }

    // Шинэ зураг upload хийсэн бол хуучин зургийг устгаж шинийг хадгалах
    if (req.file) {
      // Хуучин зургийг устгах
      if (banner.imagePath && fs.existsSync(banner.imagePath)) {
        fs.unlinkSync(banner.imagePath);
        console.log(`🗑️  Хуучин зураг устгалаа: ${banner.imagePath}`);
      }
      banner.imageUrl = getFileUrl(req, req.file.path);
      banner.imagePath = req.file.path;
      console.log(`   Шинэ зургийн URL: ${banner.imageUrl}`);
    }

    // Талбаруудыг шинэчлэх
    if (title !== undefined) banner.title = title;
    if (linkUrl !== undefined) banner.linkUrl = linkUrl;
    if (description !== undefined) banner.description = description;
    if (order !== undefined) banner.order = Number(order);
    if (isActive !== undefined) banner.isActive = isActive === 'true' || isActive === true;

    await banner.save();

    console.log(`✅ Banner шинэчлэгдлээ: ${banner.title}`);
    res.status(200).json({
      success: true,
      message: 'Banner амжилттай шинэчлэгдлээ',
      data: banner,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error(`❌ UpdateBanner алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Banner шинэчлэхэд алдаа гарлаа',
    });
  }
};

// ============================================================
// DELETE /api/admin/banners/:id - Banner устгах
// ============================================================
const deleteBanner = async (req, res) => {
  const { id } = req.params;

  console.log(`🗑️  Banner устгаж байна: ID ${id}`);

  try {
    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner олдсонгүй',
      });
    }

    // Зургийн файлыг устгах
    if (banner.imagePath && fs.existsSync(banner.imagePath)) {
      fs.unlinkSync(banner.imagePath);
      console.log(`🗑️  Зургийн файл устгалаа: ${banner.imagePath}`);
    }

    await banner.deleteOne();

    console.log(`✅ Banner устгалаа: ${banner.title}`);
    res.status(200).json({
      success: true,
      message: 'Banner амжилттай устгалаа',
    });
  } catch (error) {
    console.error(`❌ DeleteBanner алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Banner устгахад алдаа гарлаа',
    });
  }
};

module.exports = {
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
};