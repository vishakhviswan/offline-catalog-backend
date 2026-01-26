const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// CREATE product
router.post("/", productController.createProduct);

// GET all products (catalog + admin)
router.get("/", productController.getProducts);

// GET single product by id
router.get("/:id", productController.getProductById);

// UPDATE product (edit + stock toggle)
router.put("/:id", productController.updateProduct);

// DELETE product
router.delete("/:id", productController.deleteProduct);

module.exports = router;
