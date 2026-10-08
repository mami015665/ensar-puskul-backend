const mongoose = require("mongoose");

const movementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productName: { type: String, required: true },
    type: {
      type: String,
      enum: ["production", "sale"],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, default: "" },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

movementSchema.index({ type: 1, date: -1 });

module.exports = mongoose.model("Movement", movementSchema);
