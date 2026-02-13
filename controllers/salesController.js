const XLSX = require("xlsx");
const supabase = require("../supabase/client");

/* ===================================================
   STEP 1 — ANALYZE SALES FILE (NO DB INSERT)
=================================================== */
const analyzeSales = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { range: 2 });

    if (!rows.length) {
      return res.status(400).json({ error: "Empty file" });
    }

    const invoices = new Set();
    const customersMap = new Map();
    const productsMap = new Map();

    for (const row of rows) {
      const invoiceNo = row["Invoice No./Txn No."];
      const customerName = row["Party Name"];
      const productName = row["Item Name"];

      if (invoiceNo) invoices.add(invoiceNo);

      if (customerName && !customersMap.has(customerName)) {
        const { data } = await supabase
          .from("customers")
          .select("id,name")
          .ilike("name", customerName);

        if (!data || data.length === 0) {
          customersMap.set(customerName, { name: customerName, status: "new" });
        } else if (data.length === 1) {
          customersMap.set(customerName, {
            name: customerName,
            status: "matched",
            id: data[0].id,
          });
        } else {
          customersMap.set(customerName, {
            name: customerName,
            status: "multiple",
            options: data,
          });
        }
      }

      if (productName && !productsMap.has(productName)) {
        const { data } = await supabase
          .from("products")
          .select("id,name")
          .ilike("name", productName);

        if (!data || data.length === 0) {
          productsMap.set(productName, { name: productName, status: "new" });
        } else if (data.length === 1) {
          productsMap.set(productName, {
            name: productName,
            status: "matched",
            id: data[0].id,
          });
        } else {
          productsMap.set(productName, {
            name: productName,
            status: "multiple",
            options: data,
          });
        }
      }
    }

    res.json({
      total_rows: rows.length,
      total_invoices: invoices.size,
      customers: Array.from(customersMap.values()),
      products: Array.from(productsMap.values()),
    });
  } catch (err) {
    console.error("ANALYZE ERROR:", err);
    res.status(500).json({ error: err.message || "Analyze failed" });
  }
};

/* ===================================================
   STEP 2 — IMPORT SALES (YOUR EXISTING LOGIC)
=================================================== */

const importSales = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { range: 2 });

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
      let invoiceDate = new Date(firstRow["Date"] || new Date());

      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .ilike("name", customerName)
        .limit(1);

      const customerData = customer?.[0] || null;

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

      let totalAmount = 0;

      for (const row of items) {
        const productName = row["Item Name"];
        const qty = Number(row["Quantity"]) || 0;
        const price = Number(row["UnitPrice"]) || 0;
        const amount = Number(row["Amount"]) || 0;

        totalAmount += amount;

        await supabase.from("invoice_items").insert({
          invoice_id: invoice.id,
          product_name: productName,
          qty,
          price,
          total: amount,
        });
      }

      await supabase
        .from("invoices")
        .update({ total_amount: totalAmount })
        .eq("id", invoice.id);

      summary.invoices_created++;
    }

    res.json(summary);
  } catch (err) {
    console.error("IMPORT ERROR:", err);
    res.status(500).json({ error: err.message || "Import failed" });
  }
};

module.exports = { importSales, analyzeSales };
