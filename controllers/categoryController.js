const supabase = require("../config/supabase");

exports.getCategories = async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.createCategory = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const { data, error } = await supabase
    .from("categories")
    .insert([{ name }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const { data, error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
};
