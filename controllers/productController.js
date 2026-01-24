const supabase = require("../config/supabase");

/**
 * CREATE PRODUCT
 */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      category_id,
      description,
      price,
      mrp,
      discount_percentage,
      stock,
      availability,
      units,
      images,
    } = req.body;

    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          name,
          category_id,
          description,
          price,
          mrp,
          discount_percentage,
          stock,
          availability,
          units,
          images,
        },
      ])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET ALL PRODUCTS
 */
exports.getProducts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET SINGLE PRODUCT
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.status(404).json({ error: "Product not found" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * UPDATE PRODUCT
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("products")
      .update(req.body)
      .eq("id", id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE PRODUCT
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

