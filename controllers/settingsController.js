const supabase = require("../config/supabase");

exports.getSettings = async (req, res) => {
  try {
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
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
