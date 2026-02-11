const supabase = require("../config/supabase");

/* ================= CREATE ================= */
exports.createVendor = async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Vendor name required" });
    }

    const { data, error } = await supabase
      .from("vendors")
      .insert([{ name, phone, address }])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ================= GET ALL ================= */
exports.getVendors = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ================= GET ONE ================= */
exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

/* ================= UPDATE ================= */
exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address } = req.body;

    const updatePayload = {};

    if (name !== undefined) updatePayload.name = name;
    if (phone !== undefined) updatePayload.phone = phone;
    if (address !== undefined) updatePayload.address = address;

    const { data, error } = await supabase
      .from("vendors")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

/* ================= DELETE ================= */
exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("vendors").delete().eq("id", id);

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Vendor deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
