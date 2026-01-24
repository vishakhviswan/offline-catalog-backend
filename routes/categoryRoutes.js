const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

router.get("/", async (req, res) => {
  res.json(await Category.find());
});

router.post("/", async (req, res) => {
  const c = new Category(req.body);
  await c.save();
  res.json(c);
});

module.exports = router;
