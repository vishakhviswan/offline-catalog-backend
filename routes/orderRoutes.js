const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* ================= CREATE ORDER ================= */
router.post("/", async (req, res) => {
  try {
    const { customer_id, customer_name, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No items" });
    }

    const total = items.reduce(
      (sum, i) => sum + Number(i.qty) * Number(i.price),
      0,
    );

    // create order
    const { data: order, error } = await supabase
      .from("orders")
      .insert([{ customer_id, customer_name, total }])
      .select()
      .single();

    if (error) throw error;

    // create order items
    const orderItems = items.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.product_name,
      qty: i.qty,
      price: i.price,
      total: i.qty * i.price,
    }));

    await supabase.from("order_items").insert(orderItems);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= GET ORDERS ================= */
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

module.exports = router;
