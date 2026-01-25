const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// GET all categories
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// ADD category
router.post("/", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const { data, error } = await supabase
    .from("categories")
    .insert([{ name }])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data[0]);
});

module.exports = router;
