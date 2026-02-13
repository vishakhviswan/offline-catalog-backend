const express = require("express");
const multer = require("multer");
const { importSales, analyzeSales } = require("../controllers/salesController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

router.post("/analyze", upload.single("file"), analyzeSales);
router.post("/import", upload.single("file"), importSales);

module.exports = router;
