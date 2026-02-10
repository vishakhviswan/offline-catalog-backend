const supabase = require("../config/supabase");

/* ================= GET SETTINGS ================= */
exports.getSettings = async (req, res) => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const settings = {};
  data.forEach((row) => {
    settings[row.key] = row.value;
  });

  res.json(settings);
};

/* ================= UPDATE SETTINGS ================= */
exports.updateSettings = async (req, res) => {
  const updates = req.body; // { "ui.show_product_images": true }

  try {
    const payload = Object.entries(updates).map(([key, value]) => ({
      key,
      value,
    }));

    const { error } = await supabase
      .from("app_settings")
      .upsert(payload, { onConflict: ["key"] });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
