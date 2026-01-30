const supabase = require("../config/supabase");

/* ================= GET ALL ================= */
exports.getCategories = async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
};

/* ================= ADD ================= */
exports.addCategory = async (req, res) => {
  const { name } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const { data, error } = await supabase
    .from("categories")
    .insert([{ name: name.trim() }])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
};

/* ================= UPDATE ================= */
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const { data, error } = await supabase
    .from("categories")
    .update({ name: name.trim() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
};

/* ================= DELETE ================= */
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    return res.status(400).json({
      error: "Category is used by products",
    });
  }

  res.json({ success: true });
};
