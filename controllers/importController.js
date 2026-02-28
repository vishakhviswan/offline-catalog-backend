const { supabase } = require("../config/supabase");

exports.reconcileImport = async (req, res) => {
  try {
    const { customers, products } = req.body;

    if (!customers || !products) {
      return res.status(400).json({ error: "Missing customers or products" });
    }

    const customerResults = [];
    const productResults = [];

    /* ------------------ CUSTOMER MATCHING ------------------ */
    for (const name of customers) {
      // 1️⃣ Alias match
      const { data: aliasMatch } = await supabase
        .from("customer_aliases")
        .select("customer_id")
        .ilike("alias_name", name)
        .single();

      if (aliasMatch) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id, name")
          .eq("id", aliasMatch.customer_id)
          .single();

        customerResults.push({
          excelName: name,
          type: "exact",
          match: customer,
        });
        continue;
      }

      // 2️⃣ Exact match
      const { data: exactMatch } = await supabase
        .from("customers")
        .select("id, name")
        .ilike("name", name);

      if (exactMatch && exactMatch.length > 0) {
        customerResults.push({
          excelName: name,
          type: "exact",
          match: exactMatch[0],
        });
        continue;
      }

      // 3️⃣ Similar match (basic)
      const { data: similarMatch } = await supabase
        .from("customers")
        .select("id, name")
        .ilike("name", `%${name}%`);

      if (similarMatch && similarMatch.length > 0) {
        customerResults.push({
          excelName: name,
          type: "similar",
          suggestions: similarMatch,
        });
      } else {
        customerResults.push({
          excelName: name,
          type: "new",
        });
      }
    }

    /* ------------------ PRODUCT MATCHING ------------------ */
    for (const name of products) {
      const { data: aliasMatch } = await supabase
        .from("product_aliases")
        .select("product_id")
        .ilike("alias_name", name)
        .single();

      if (aliasMatch) {
        const { data: product } = await supabase
          .from("products")
          .select("id, name")
          .eq("id", aliasMatch.product_id)
          .single();

        productResults.push({
          excelName: name,
          type: "exact",
          match: product,
        });
        continue;
      }

      const { data: exactMatch } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", name);

      if (exactMatch && exactMatch.length > 0) {
        productResults.push({
          excelName: name,
          type: "exact",
          match: exactMatch[0],
        });
        continue;
      }

      const { data: similarMatch } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", `%${name}%`);

      if (similarMatch && similarMatch.length > 0) {
        productResults.push({
          excelName: name,
          type: "similar",
          suggestions: similarMatch,
        });
      } else {
        productResults.push({
          excelName: name,
          type: "new",
        });
      }
    }

    return res.json({
      customers: customerResults,
      products: productResults,
    });
  } catch (error) {
    console.error("Reconcile Error:", error);
    return res.status(500).json({ error: "Reconcile failed" });
  }
};
