const { supabase } = require("../config/supabase");
const supabaseClient = supabase || require("../config/supabase");

const STATUS = {
  EXACT_MATCH: "exact_match",
  ALIAS_MATCH: "alias_match",
  SIMILAR_MATCH: "similar_match",
  NEW_REQUIRED: "new_required",
};

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeExcelName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function likePattern(value) {
  return `%${value.replace(/[%_]/g, "")}%`;
}

function dedupeById(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row || row.id == null) {
      continue;
    }

    if (!map.has(row.id)) {
      map.set(row.id, { id: row.id, name: row.name });
    }
  }

  return Array.from(map.values());
}

async function findExactMatch(tableName, excelName) {
  const { data, error } = await supabaseClient
    .from(tableName)
    .select("id, name")
    .ilike("name", excelName)
    .limit(1);

  if (error) {
    throw error;
  }

  return data && data.length ? data[0] : null;
}

async function findAliasMatch(aliasTable, entityTable, fkColumn, excelName) {
  const { data: aliasRows, error: aliasError } = await supabaseClient
    .from(aliasTable)
    .select(fkColumn)
    .ilike("alias_name", excelName)
    .limit(1);

  if (aliasError) {
    throw aliasError;
  }

  if (!aliasRows || !aliasRows.length || aliasRows[0][fkColumn] == null) {
    return null;
  }

  const entityId = aliasRows[0][fkColumn];

  const { data: entities, error: entityError } = await supabaseClient
    .from(entityTable)
    .select("id, name")
    .eq("id", entityId)
    .limit(1);

  if (entityError) {
    throw entityError;
  }

  return entities && entities.length ? entities[0] : null;
}

async function findSimilarMatches(aliasTable, entityTable, fkColumn, excelName) {
  const pattern = likePattern(excelName);

  const { data: entityRows, error: entityError } = await supabaseClient
    .from(entityTable)
    .select("id, name")
    .ilike("name", pattern)
    .limit(15);

  if (entityError) {
    throw entityError;
  }

  const { data: aliasRows, error: aliasError } = await supabaseClient
    .from(aliasTable)
    .select(fkColumn)
    .ilike("alias_name", pattern)
    .limit(30);

  if (aliasError) {
    throw aliasError;
  }

  const aliasIds = Array.from(
    new Set(
      (aliasRows || [])
        .map((row) => row[fkColumn])
        .filter((value) => value !== null && value !== undefined),
    ),
  );

  let aliasEntities = [];

  if (aliasIds.length > 0) {
    const { data, error } = await supabaseClient
      .from(entityTable)
      .select("id, name")
      .in("id", aliasIds)
      .limit(15);

    if (error) {
      throw error;
    }

    aliasEntities = data || [];
  }

  return dedupeById([...(entityRows || []), ...aliasEntities]);
}

async function reconcileSingleName(excelName, config) {
  const normalized = normalizeExcelName(excelName);

  if (!normalized) {
    return {
      excelName,
      status: STATUS.NEW_REQUIRED,
    };
  }

  const exactMatch = await findExactMatch(config.entityTable, normalized);
  if (exactMatch) {
    return {
      excelName,
      status: STATUS.EXACT_MATCH,
      match: exactMatch,
    };
  }

  const aliasMatch = await findAliasMatch(
    config.aliasTable,
    config.entityTable,
    config.fkColumn,
    normalized,
  );

  if (aliasMatch) {
    return {
      excelName,
      status: STATUS.ALIAS_MATCH,
      match: aliasMatch,
    };
  }

  const suggestions = await findSimilarMatches(
    config.aliasTable,
    config.entityTable,
    config.fkColumn,
    normalized,
  );

  if (suggestions.length) {
    return {
      excelName,
      status: STATUS.SIMILAR_MATCH,
      suggestions,
    };
  }

  return {
    excelName,
    status: STATUS.NEW_REQUIRED,
  };
}

async function reconcileList(names, config) {
  const values = toArray(names);
  const results = [];

  for (const excelName of values) {
    const result = await reconcileSingleName(excelName, config);
    results.push(result);
  }

  return results;
}

const reconcileImport = async (req, res) => {
  try {
    const { customers, products } = req.body || {};

    const [customerResults, productResults] = await Promise.all([
      reconcileList(customers, {
        entityTable: "customers",
        aliasTable: "customer_aliases",
        fkColumn: "customer_id",
      }),
      reconcileList(products, {
        entityTable: "products",
        aliasTable: "product_aliases",
        fkColumn: "product_id",
      }),
    ]);

    return res.status(200).json({
      customers: customerResults,
      products: productResults,
    });
  } catch (err) {
    console.error("Import reconcile failed:", err);

    return res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
};

module.exports = { reconcileImport };
