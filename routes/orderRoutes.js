const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");

/* ================= CREATE ORDER ================= */
router.post("/", async (req, res) => {
  try {
    const { customer_id, items, total } = req.body;

    if (!customer_id || !items?.length) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    /* ---- insert order ---- */
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert([{ customer_id, total }])
      .select()
      .single();

    if (orderErr) throw orderErr;

    /* ---- insert items ---- */
    const orderItems = items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      qty: i.qty,
      price: i.price,
      total: i.total,
    }));

    const { error: itemErr } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemErr) throw itemErr;

    res.json({ success: true, order_id: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Order creation failed" });
  }
});

/* ================= GET ALL ORDERS ================= */
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        customers ( name, mobile )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch {
    res.status(500).json({ message: "Failed to load orders" });
  }
});

/* ================= GET SINGLE ORDER ================= */
router.get("/:id", async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        customers ( name, mobile )
      `,
      )
      .eq("id", req.params.id)
      .single();

    if (error) throw error;

    const { data: items } = await supabase
      .from("order_items")
      .select(
        `
        *,
        products ( name, images )
      `,
      )
      .eq("order_id", req.params.id);

    res.json({ order, items });
  } catch {
    res.status(500).json({ message: "Failed to fetch order" });
  }
});

/* ================= DELETE ORDER ================= */
router.delete("/:id", async (req, res) => {
  try {
    await supabase.from("orders").delete().eq("id", req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;
