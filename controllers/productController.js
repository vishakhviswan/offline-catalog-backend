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
 * BULK IMPORT PRODUCTS
 * - Auto create category
 * - Normalize units
 * - Stock → availability auto
 * - Update if same name + category exists
 */
exports.bulkImportProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "No products provided" });
    }

    /* ---------- LOAD CATEGORIES ---------- */
    const { data: categories, error: catErr } = await supabase
      .from("categories")
      .select("id,name");

    if (catErr) throw catErr;

    const categoryMap = {};
    categories.forEach((c) => {
      categoryMap[c.name.toLowerCase()] = c.id;
    });

    const success = [];
    const failed = [];

    /* ---------- PROCESS EACH ROW ---------- */
    for (const row of products) {
      try {
        if (!row.name || !row.category || !row.price) {
          throw new Error("Missing name / category / price");
        }

        /* ===== CATEGORY AUTO CREATE ===== */
        let categoryId = categoryMap[row.category.toLowerCase()];

        if (!categoryId) {
          const { data: newCat, error } = await supabase
            .from("categories")
            .insert([{ name: row.category.trim() }])
            .select()
            .single();

          if (error) throw error;

          categoryId = newCat.id;
          categoryMap[row.category.toLowerCase()] = categoryId;
        }

        /* ===== UNITS NORMALIZE ===== */
        let units = [{ name: "pcs", multiplier: 1 }];

        if (row.units) {
          if (Array.isArray(row.units)) {
            units = row.units;
          } else if (typeof row.units === "string") {
            units = row.units.split(",").map((u) => ({
              name: u.trim(),
              multiplier: 1,
            }));
          }
        }

        /* ===== STOCK LOGIC ===== */
        const stock = Number(row.stock) || 0;
        const availability = stock > 0;

        /* ===== CHECK DUPLICATE ===== */
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("name", row.name.trim())
          .eq("category_id", categoryId)
          .maybeSingle();

        const payload = {
          name: row.name.trim(),
          category_id: categoryId,
          price: Number(row.price),
          mrp: row.mrp ? Number(row.mrp) : null,
          discount_percentage: row.discount_percentage || 0,
          stock,
          availability,
          units,
          images: [],
        };

        if (existing) {
          await supabase
            .from("products")
            .update(payload)
            .eq("id", existing.id);
        } else {
          await supabase.from("products").insert([payload]);
        }

        success.push(row.name);
      } catch (err) {
        failed.push({
          product: row.name || "Unknown",
          reason: err.message,
        });
      }
    }

    res.json({
      message: "Bulk import completed",
      successCount: success.length,
      failedCount: failed.length,
      failed,
    });
  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({ error: "Bulk import failed" });
  }
};