const XLSX = require("xlsx");
const supabase = require("../config/supabase");

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function groupRowsByInvoice(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const invoiceNo = normalizeText(String(row.invoice_no || ""));
    if (!invoiceNo) {
      continue;
    }

    if (!grouped.has(invoiceNo)) {
      grouped.set(invoiceNo, []);
    }

    grouped.get(invoiceNo).push(row);
  }

  return grouped;
}

async function getCustomerIdByName(name, cache) {
  const key = name.toLowerCase();
  if (cache.has(key)) {
    return cache.get(key);
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .ilike("name", name)
    .limit(1);

  if (error) {
    throw error;
  }

  const customerId = data && data.length ? data[0].id : null;
  if (!customerId) {
    throw new Error(`Customer not found: ${name}`);
  }

  cache.set(key, customerId);
  return customerId;
}

async function getProductIdByName(name, cache) {
  const key = name.toLowerCase();
  if (cache.has(key)) {
    return cache.get(key);
  }

  const { data, error } = await supabase
    .from("products")
    .select("id")
    .ilike("name", name)
    .limit(1);

  if (error) {
    throw error;
  }

  const productId = data && data.length ? data[0].id : null;
  if (!productId) {
    throw new Error(`Product not found: ${name}`);
  }

  cache.set(key, productId);
  return productId;
}

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

      if (invoiceNo) {
        invoices.add(invoiceNo);
      }

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

    return res.json({
      total_rows: rows.length,
      total_invoices: invoices.size,
      customers: Array.from(customersMap.values()),
      products: Array.from(productsMap.values()),
    });
  } catch (err) {
    console.error("ANALYZE ERROR:", err);
    return res.status(500).json({ error: err.message || "Analyze failed" });
  }
};

const importSales = async (req, res) => {
  const createdInvoiceIds = [];

  try {
    const { rows } = req.body || {};

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "rows must be an array" });
    }

    if (rows.length === 0) {
      return res.status(200).json({
        created_invoices: 0,
        created_items: 0,
      });
    }

    const groupedInvoices = groupRowsByInvoice(rows);
    const customerCache = new Map();
    const productCache = new Map();
    let createdInvoices = 0;
    let createdItems = 0;

    for (const [invoiceNo, invoiceRows] of groupedInvoices.entries()) {
      if (!invoiceRows.length) {
        continue;
      }

      const customerName = normalizeText(invoiceRows[0].customer_name);
      if (!customerName) {
        throw new Error(`Missing customer_name for invoice ${invoiceNo}`);
      }

      const customerId = await getCustomerIdByName(customerName, customerCache);

      const itemPayload = [];
      let totalAmount = 0;

      for (const row of invoiceRows) {
        const productName = normalizeText(row.product_name);
        if (!productName) {
          throw new Error(`Missing product_name for invoice ${invoiceNo}`);
        }

        const qty = toFiniteNumber(row.qty);
        const rate = toFiniteNumber(row.rate);

        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error(`Invalid qty for invoice ${invoiceNo}`);
        }

        if (!Number.isFinite(rate) || rate < 0) {
          throw new Error(`Invalid rate for invoice ${invoiceNo}`);
        }

        const productId = await getProductIdByName(productName, productCache);
        const lineTotal = qty * rate;
        totalAmount += lineTotal;

        itemPayload.push({
          product_id: productId,
          qty,
          rate,
          line_total: lineTotal,
        });
      }

      const { data: invoiceRow, error: invoiceError } = await supabase
        .from("sales_invoices")
        .insert([
          {
            invoice_no: String(invoiceNo),
            customer_id: customerId,
            total_amount: totalAmount,
          },
        ])
        .select("id")
        .single();

      if (invoiceError) {
        throw invoiceError;
      }

      const invoiceId = invoiceRow.id;
      createdInvoiceIds.push(invoiceId);

      const itemsToInsert = itemPayload.map((item) => ({
        invoice_id: invoiceId,
        product_id: item.product_id,
        qty: item.qty,
        rate: item.rate,
        line_total: item.line_total,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from("sales_invoice_items")
        .insert(itemsToInsert)
        .select("id");

      if (itemsError) {
        throw itemsError;
      }

      createdInvoices += 1;
      createdItems += insertedItems ? insertedItems.length : itemsToInsert.length;
    }

    return res.status(200).json({
      created_invoices: createdInvoices,
      created_items: createdItems,
    });
  } catch (err) {
    if (createdInvoiceIds.length > 0) {
      const { error: rollbackItemsError } = await supabase
        .from("sales_invoice_items")
        .delete()
        .in("invoice_id", createdInvoiceIds);

      if (rollbackItemsError) {
        console.error("ROLLBACK ITEMS ERROR:", rollbackItemsError);
      }

      const { error: rollbackInvoicesError } = await supabase
        .from("sales_invoices")
        .delete()
        .in("id", createdInvoiceIds);

      if (rollbackInvoicesError) {
        console.error("ROLLBACK INVOICES ERROR:", rollbackInvoicesError);
      }
    }

    console.error("IMPORT ERROR:", err);
    return res.status(500).json({ error: err.message || "Import failed" });
  }
};

module.exports = { importSales, analyzeSales };
