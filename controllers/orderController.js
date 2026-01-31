const supabase = require("../config/supabase");

/* ================= CREATE ORDER ================= */
exports.createOrder = async (req, res) => {
  try {
    const { customer_id = null, customer_name, items } = req.body;

    if (!customer_name) {
      return res.status(400).json({ error: "Customer name required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in order" });
    }

  const total = items.reduce((sum, i) => {
    const qty = Number(i.qty) || 0;
    const price = Number(i.price) || 0;
    const mul = Number(i.unitMultiplier) || 1;
    return sum + qty * price * mul;
  }, 0);

    /* 1️⃣ INSERT ORDER */
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          customer_id,
          customer_name,
          total,
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    /* 2️⃣ INSERT ORDER ITEMS */
    const orderItems = items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      product_name: i.name,
      qty: Number(i.qty),
      price: Number(i.price),
      unit_name: i.unitName || "pcs",
      unit_multiplier: Number(i.unitMultiplier || 1),
      total: Number(i.qty) * Number(i.price) * Number(i.unitMultiplier || 1),
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    res.json({
      success: true,
      order_id: order.id,
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ================= GET ALL ORDERS ================= */
exports.getOrders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (*)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("GET ORDERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
