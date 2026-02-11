const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");

// CREATE
router.post("/", vendorController.createVendor);

// GET ALL
router.get("/", vendorController.getVendors);

// GET ONE
router.get("/:id", vendorController.getVendorById);

// UPDATE
router.put("/:id", vendorController.updateVendor);

// DELETE
router.delete("/:id", vendorController.deleteVendor);

module.exports = router;