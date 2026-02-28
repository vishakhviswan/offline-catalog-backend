const express = require("express");
const { reconcileImport } = require("../controllers/importController");

const router = express.Router();

router.post("/reconcile", reconcileImport);

module.exports = router;
