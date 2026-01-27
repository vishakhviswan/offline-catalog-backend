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
      stock = 0,
      units,
      images,
    } = req.body;

    const availability = stock > 0;

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
      .select()
      .single();

    if (error) {
      console.error("Create product error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error("Create product exception:", err);
    res.status(500).json({ error: "Server error" });
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

    if (error) {
      console.error("Get products error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error("Get products exception:", err);
    res.status(500).json({ error: "Server error" });
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

    if (error) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(data);
  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * UPDATE PRODUCT (ADMIN + STOCK TOGGLE)
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      category_id,
      description,
      price,
      mrp,
      discount_percentage,
      stock,
      units,
      images,
    } = req.body;

    // 🔒 build update payload only with provided fields
    const updatePayload = {};

    if (name !== undefined) updatePayload.name = name;
    if (category_id !== undefined) updatePayload.category_id = category_id;
    if (description !== undefined) updatePayload.description = description;
    if (price !== undefined) updatePayload.price = price;
    if (mrp !== undefined) updatePayload.mrp = mrp;
    if (discount_percentage !== undefined)
      updatePayload.discount_percentage = discount_percentage;
    if (units !== undefined) updatePayload.units = units;
    if (images !== undefined) updatePayload.images = images;

    // ✅ STOCK + AVAILABILITY LOGIC (KEY FIX)
    if (stock !== undefined) {
      updatePayload.stock = stock;
      updatePayload.availability = stock > 0;
    }

    const { data, error } = await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update product error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error("Update product exception:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DELETE PRODUCT
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Delete product error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete product exception:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * BULK CREATE PRODUCTS
 * - auto create category if not exists
 * - accepts array of products
 */
exports.bulkCreateProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "No products provided" });
    }

    /* ================== CATEGORIES ================== */
    const categoryNames = [
      ...new Set(products.map((p) => p.category_name || "General")),
    ];

    // existing categories
    const { data: existingCats } = await supabase
      .from("categories")
      .select("*")
      .in("name", categoryNames);

    const categoryMap = {};
    existingCats?.forEach((c) => {
      categoryMap[c.name] = c.id;
    });

    // missing categories
    const missing = categoryNames.filter((n) => !categoryMap[n]);

    if (missing.length) {
      const { data: newCats, error } = await supabase
        .from("categories")
        .insert(missing.map((name) => ({ name })))
        .select();

      if (error) throw error;

      newCats.forEach((c) => {
        categoryMap[c.name] = c.id;
      });
    }

    /* ================== PRODUCTS ================== */
    const payload = products.map((p) => ({
      name: p.name,
      category_id: categoryMap[p.category_name] || null,
      price: p.price,
      mrp: p.mrp || null,
      discount_percentage: 0,
      stock: p.stock || 0,
      availability: (p.stock || 0) > 0,
      units: p.units || [{ name: "pcs", multiplier: 1 }],
      images: [],
    }));

    let success = 0;
    const BATCH_SIZE = 300;

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase
        .from("products")
        .insert(batch)
        .select("id");

      if (error) {
        console.error("Batch insert failed:", error);
        continue;
      }

      success += data.length;
    }

    res.json({
      success,
      failed: payload.length - success,
    });
  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({ error: err.message || "Bulk import failed" });
  }
};
