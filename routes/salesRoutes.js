const express = require("express");
const multer = require("multer");
const { importSales } = require("../controllers/salesController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", upload.single("file"), importSales);

module.exports = router;
