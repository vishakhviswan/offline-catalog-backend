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

  data.forEach(({ key, value }) => {
    // SAFETY: only dotted keys allowed
    if (!key.includes(".")) return;

    const parts = key.split(".");
    let obj = settings;

    while (parts.length > 1) {
      const p = parts.shift();
      if (!obj[p]) obj[p] = {};
      obj = obj[p];
    }

    obj[parts[0]] = value;
  });

  res.json(settings);
};

/* ================= UPDATE SETTING ================= */
exports.updateSetting = async (req, res) => {
  const { key, value } = req.body;

  if (!key || !key.includes(".")) {
    return res.status(400).json({ error: "Invalid setting key" });
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
};
