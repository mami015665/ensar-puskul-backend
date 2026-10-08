const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Tüm ürünler
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Tek ürün
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Yeni ürün ekle (opsiyonel başlangıç stoğu)
router.post("/", async (req, res) => {
  try {
    const { name, initialStock } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Ürün adı zorunlu" });
    }

    const exists = await Product.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
    });
    if (exists) {
      return res.status(409).json({ message: "Bu isimde ürün zaten var" });
    }

    const stock = Math.max(0, parseInt(initialStock) || 0);
    const product = new Product({
      name: name.trim(),
      totalProduced: stock,
      totalSold: 0,
      currentStock: stock,
      lastProductionDate: stock > 0 ? new Date() : null,
    });
    const saved = await product.save();

    // Başlangıç stoğu varsa Movement da oluştur
    if (stock > 0) {
      const Movement = require("../models/Movement");
      await Movement.create({
        product: saved._id,
        productName: saved.name,
        type: "production",
        quantity: stock,
        note: "Başlangıç stoğu",
        date: new Date(),
      });
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error("Ürün ekleme hatası:", err);
    res.status(400).json({ message: err.message });
  }
});

// Ürün sil
router.delete("/:id", async (req, res) => {
  try {
    const Movement = require("../models/Movement");
    const movementCount = await Movement.countDocuments({
      product: req.params.id,
    });

    if (movementCount > 0) {
      return res.status(409).json({
        message: `Bu ürüne ait ${movementCount} hareket kaydı var. Önce hareketleri sil.`,
        code: "HAS_MOVEMENTS",
      });
    }

    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Ürün bulunamadı" });
    res.json({ message: "Ürün silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
