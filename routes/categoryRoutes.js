const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");

// GET all
router.get("/", categoryController.getCategories);

// ADD
router.post("/", categoryController.createCategory);

// UPDATE
router.put("/:id", categoryController.updateCategory);

// DELETE
router.delete("/:id", categoryController.deleteCategory);

module.exports = router;
