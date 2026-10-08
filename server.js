const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/products", require("./routes/products"));
app.use("/api/movements", require("./routes/movements"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("Sunucu hatası:", err);
  res.status(500).json({ message: err.message || "Sunucu hatası" });
});

const PORT = process.env.PORT || 5001;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✓ MongoDB bağlandı");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server çalışıyor: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("✗ MongoDB hatası:", err);
    process.exit(1);
  });
