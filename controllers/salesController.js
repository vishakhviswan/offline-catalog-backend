const XLSX = require("xlsx");
const supabase = require("../supabase/client");

const importSales = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const grouped = {};

    rows.forEach((row) => {
      const invoiceNo = row["Invoice No./Txn No."];
      if (!grouped[invoiceNo]) grouped[invoiceNo] = [];
      grouped[invoiceNo].push(row);
    });

    let summary = {
      invoices_created: 0,
      orders_linked: 0,
      partial_orders: 0,
      standalone_invoices: 0,
    };

    for (const invoiceNo in grouped) {
      const items = grouped[invoiceNo];
      const firstRow = items[0];

      const customerName = firstRow["Party Name"];
      const invoiceDate = new Date(firstRow["Date"]);
      let totalAmount = 0;

      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .ilike("name", customerName)
        .single();

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_no: invoiceNo,
          invoice_date: invoiceDate,
          customer_id: customer?.id || null,
          customer_name: customerName,
          source: "vyapar",
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      for (const row of items) {
        const productName = row["Item Name"];
        const qty = Number(row["Quantity"]) || 0;
        const price = Number(row["UnitPrice"]) || 0;
        const amount = Number(row["Amount"]) || 0;

        totalAmount += amount;

        const { data: product } = await supabase
          .from("products")
          .select("*")
          .ilike("name", productName)
          .single();

        await supabase.from("invoice_items").insert({
          invoice_id: invoice.id,
          product_id: product?.id || null,
          product_name: productName,
          qty,
          price,
          total: amount,
        });

        if (product) {
          await supabase
            .from("products")
            .update({ stock: product.stock - qty })
            .eq("id", product.id);
        }
      }

      await supabase
        .from("invoices")
        .update({ total_amount: totalAmount })
        .eq("id", invoice.id);

      summary.invoices_created++;

      if (customer?.id) {
        const { data: order } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("customer_id", customer.id)
          .in("status", ["open", "partial_open"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (order) {
          let fullMatch = true;

          for (const oi of order.order_items) {
            const invItem = items.find(
              (r) => r["Item Name"] === oi.product_name,
            );

            if (!invItem || Number(invItem["Quantity"]) !== oi.qty) {
              fullMatch = false;
              break;
            }
          }

          if (fullMatch) {
            await supabase
              .from("orders")
              .update({
                status: "closed",
                invoice_id: invoice.id,
              })
              .eq("id", order.id);

            summary.orders_linked++;
          } else {
            await supabase
              .from("orders")
              .update({
                status: "partial_open",
                invoice_id: invoice.id,
              })
              .eq("id", order.id);

            summary.partial_orders++;
          }
        } else {
          summary.standalone_invoices++;
        }
      }
    }

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Import failed" });
  }
};

module.exports = { importSales };
