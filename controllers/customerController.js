const supabase = require("../config/supabase");

/* GET */
exports.getCustomers = async (req, res) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("id", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
};

/* POST */
exports.addCustomer = async (req, res) => {
  const { name, mobile, route } = req.body;

  const { data, error } = await supabase
    .from("customers")
    .insert([{ name, mobile: mobile || null, route: route || null }])
    .select()
    .single();

  if (error) return res.status(500).json(error);
  res.json(data);
};

/* PUT */
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, mobile, route } = req.body;

  const { data, error } = await supabase
    .from("customers")
    .update({ name, mobile, route })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json(error);
  res.json(data);
};

/* DELETE */
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) return res.status(500).json(error);
  res.json({ success: true });
};
