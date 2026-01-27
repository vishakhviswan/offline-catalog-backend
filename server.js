const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());

// 🔑 FIX: increase body size for bulk import
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));

app.get("/", (req, res) => {
  res.send("Offline Catalog Backend Running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
