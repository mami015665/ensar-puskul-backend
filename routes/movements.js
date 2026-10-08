const express = require("express");
const router = express.Router();
const Movement = require("../models/Movement");
const Product = require("../models/Product");

// Tüm hareketler (opsiyonel filtre: ?type=production&productId=xxx&limit=50)
router.get("/", async (req, res) => {
  try {
    const { type, productId, limit } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (productId) filter.product = productId;

    let query = Movement.find(filter)
      .populate("product", "name")
      .sort({ date: -1 });
    if (limit) query = query.limit(parseInt(limit));

    const movements = await query;
    res.json(movements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// İstatistikler — grafikler için
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();

    // Son 7 gün (günlük)
    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { produced: 0, sold: 0 };
    }

    // Son 30 gün
    const monthlyMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      monthlyMap[key] = { produced: 0, sold: 0 };
    }

    const movements = await Movement.find().lean();

    movements.forEach((m) => {
      const dayKey = new Date(m.date).toISOString().split("T")[0];
      const qty = m.quantity || 0;
      const isProd = m.type === "production";

      if (dailyMap[dayKey]) {
        if (isProd) dailyMap[dayKey].produced += qty;
        else dailyMap[dayKey].sold += qty;
      }
      if (monthlyMap[dayKey]) {
        if (isProd) monthlyMap[dayKey].produced += qty;
        else monthlyMap[dayKey].sold += qty;
      }
    });

    // Toplamlar
    const totals = movements.reduce(
      (acc, m) => {
        if (m.type === "production") acc.produced += m.quantity;
        else acc.sold += m.quantity;
        return acc;
      },
      { produced: 0, sold: 0 },
    );

    // En çok üretilen 5 ürün
    const productAgg = await Movement.aggregate([
      { $match: { type: "production" } },
      {
        $group: {
          _id: "$product",
          productName: { $first: "$productName" },
          total: { $sum: "$quantity" },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      daily: Object.entries(dailyMap).map(([date, val]) => ({
        date,
        label: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
        ...val,
      })),
      monthly: Object.entries(monthlyMap).map(([date, val]) => ({
        date,
        label: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
        ...val,
      })),
      totals,
      topProducts: productAgg,
    });
  } catch (err) {
    console.error("İstatistik hatası:", err);
    res.status(500).json({ message: err.message });
  }
});

// Yeni hareket ekle (üretim veya satış)
router.post("/", async (req, res) => {
  try {
    const { productId, type, quantity, note, date } = req.body;

    if (!productId) return res.status(400).json({ message: "Ürün seçilmeli" });
    if (!["production", "sale"].includes(type)) {
      return res.status(400).json({ message: "Geçersiz hareket tipi" });
    }

    const qty = parseInt(quantity);
    if (!qty || qty < 1) {
      return res.status(400).json({ message: "Adet en az 1 olmalı" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });

    // Satışta stok kontrolü
    if (type === "sale" && product.currentStock < qty) {
      return res.status(400).json({
        message: `Yetersiz stok. Mevcut: ${product.currentStock} adet`,
      });
    }

    const movement = await Movement.create({
      product: product._id,
      productName: product.name,
      type,
      quantity: qty,
      note: note || "",
      date: date ? new Date(date) : new Date(),
    });

    // Ürünün stok değerlerini güncelle
    if (type === "production") {
      product.totalProduced += qty;
      product.lastProductionDate = date ? new Date(date) : new Date();
    } else {
      product.totalSold += qty;
    }
    product.currentStock = product.totalProduced - product.totalSold;
    await product.save();

    res.status(201).json({ movement, product });
  } catch (err) {
    console.error("Hareket ekleme hatası:", err);
    res.status(400).json({ message: err.message });
  }
});

// Hareket sil (ürün stokunu geri alır)
router.delete("/:id", async (req, res) => {
  try {
    const movement = await Movement.findById(req.params.id);
    if (!movement)
      return res.status(404).json({ message: "Hareket bulunamadı" });

    const product = await Product.findById(movement.product);
    if (product) {
      if (movement.type === "production") {
        product.totalProduced = Math.max(
          0,
          product.totalProduced - movement.quantity,
        );
      } else {
        product.totalSold = Math.max(0, product.totalSold - movement.quantity);
      }
      product.currentStock = product.totalProduced - product.totalSold;
      await product.save();
    }

    await Movement.findByIdAndDelete(req.params.id);
    res.json({ message: "Hareket silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
