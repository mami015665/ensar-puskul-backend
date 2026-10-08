const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    totalProduced: { type: Number, default: 0, min: 0 },
    totalSold: { type: Number, default: 0, min: 0 },
    currentStock: { type: Number, default: 0 },
    lastProductionDate: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);
