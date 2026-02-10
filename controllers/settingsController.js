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
  data.forEach((s) => {
    settings[s.key] = s.value;
  });

  res.json(settings);
};

/* ================= UPDATE SETTING ================= */
exports.updateSetting = async (req, res) => {
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({ error: "Key required" });
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) {
    console.error("Settings update error:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
};
