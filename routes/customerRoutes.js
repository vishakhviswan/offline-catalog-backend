const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");

router.get("/", async (req, res) => {
  res.json(await Customer.find());
});

router.post("/", async (req, res) => {
  const c = new Customer(req.body);
  await c.save();
  res.json(c);
});

module.exports = router;
