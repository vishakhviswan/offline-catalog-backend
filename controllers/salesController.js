const XLSX = require("xlsx");
const supabase = require("../supabase/client");

const importSales = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
   const rows = XLSX.utils.sheet_to_json(sheet, {
     range: 2, // skip first 2 rows
   });

console.log("HEADERS:", Object.keys(rows[0]));

    if (!rows.length) {
      return res.status(400).json({ error: "Empty file" });
    }

    const grouped = {};

    rows.forEach((row) => {
      const invoiceNo = row["Invoice No./Txn No."];

      if (!invoiceNo) return;

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

      const customerName = firstRow["Party Name"] || "Unknown";

      /* ================= DATE FIX ================= */
      let rawDate = firstRow["Date"];
      let invoiceDate = null;

      if (rawDate) {
        if (typeof rawDate === "number") {
          invoiceDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        } else {
          invoiceDate = new Date(rawDate);
        }
      }

      if (!invoiceDate || isNaN(invoiceDate.getTime())) {
        console.log("Invalid date detected. Using current date.");
        invoiceDate = new Date();
      }

      let totalAmount = 0;

      /* ================= FIND CUSTOMER ================= */
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .ilike("name", customerName)
        .limit(1);

      const customerData = customer?.[0] || null;

      /* ================= CREATE INVOICE ================= */
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_no: String(invoiceNo),
          invoice_date: invoiceDate,
          customer_id: customerData?.id || null,
          customer_name: customerName,
          total_amount: 0,
          source: "vyapar",
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      /* ================= INSERT ITEMS ================= */
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
          .limit(1);

        const productData = product?.[0] || null;

        await supabase.from("invoice_items").insert({
          invoice_id: invoice.id,
          product_id: productData?.id || null,
          product_name: productName,
          qty,
          price,
          total: amount,
        });

        /* ================= STOCK UPDATE ================= */
        if (productData) {
          await supabase
            .from("products")
            .update({ stock: (productData.stock || 0) - qty })
            .eq("id", productData.id);
        }
      }

      /* ================= UPDATE TOTAL ================= */
      await supabase
        .from("invoices")
        .update({ total_amount: totalAmount })
        .eq("id", invoice.id);

      summary.invoices_created++;

      /* ================= ORDER LINKING ================= */
      if (customerData?.id) {
        const { data: order } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("customer_id", customerData.id)
          .in("status", ["open", "partial_open"])
          .order("created_at", { ascending: false })
          .limit(1);

        const latestOrder = order?.[0] || null;

        if (latestOrder) {
          let fullMatch = true;

          for (const oi of latestOrder.order_items || []) {
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
              .eq("id", latestOrder.id);

            summary.orders_linked++;
          } else {
            await supabase
              .from("orders")
              .update({
                status: "partial_open",
                invoice_id: invoice.id,
              })
              .eq("id", latestOrder.id);

            summary.partial_orders++;
          }
        } else {
          summary.standalone_invoices++;
        }
      }
    }

    res.json(summary);
  } catch (err) {
    console.error("IMPORT ERROR:", err);
    res.status(500).json({ error: err.message || "Import failed" });
  }
};

module.exports = { importSales };
