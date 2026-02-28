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

function normalizeName(name) {
  if (typeof name !== "string") {
    return "";
  }

  return name
    .toLowerCase()
    .replace(/\bmrp\b\s*[:\-]?\s*\d+(\.\d+)?/g, " ")
    .replace(/\bmrp\b/g, " ")
    .replace(/\d+(\.\d+)?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function tokenize(name) {
  const normalized = normalizeName(name);
  if (!normalized) {
    return [];
  }

  return normalized.split(" ").filter(Boolean);
}

function calculateSimilarity(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let overlapCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlapCount += 1;
    }
  }

  return overlapCount / tokensA.size;
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

function buildOrLikeQuery(columnName, tokens) {
  const safeTokens = tokens
    .map((token) => token.replace(/[%_,.()]/g, ""))
    .filter((token) => token.length >= 2)
    .slice(0, 8);

  if (!safeTokens.length) {
    return "";
  }

  return safeTokens.map((token) => `${columnName}.ilike.%${token}%`).join(",");
}

async function findEntityCandidates(entityTable, tokens) {
  let query = supabaseClient.from(entityTable).select("id, name").limit(150);
  const orQuery = buildOrLikeQuery("name", tokens);

  if (orQuery) {
    query = query.or(orQuery);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

async function findAliasCandidates(aliasTable, fkColumn, tokens) {
  let query = supabaseClient
    .from(aliasTable)
    .select(`${fkColumn}, alias_name`)
    .limit(200);
  const orQuery = buildOrLikeQuery("alias_name", tokens);

  if (orQuery) {
    query = query.or(orQuery);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

async function fetchEntitiesByIds(entityTable, ids) {
  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from(entityTable)
    .select("id, name")
    .in("id", ids)
    .limit(150);

  if (error) {
    throw error;
  }

  return data || [];
}

async function findSimilarMatches(aliasTable, entityTable, fkColumn, excelName) {
  const similarityThreshold = 0.6;
  const excelTokens = tokenize(excelName);

  if (!excelTokens.length) {
    return [];
  }

  const [entityCandidates, aliasCandidates] = await Promise.all([
    findEntityCandidates(entityTable, excelTokens),
    findAliasCandidates(aliasTable, fkColumn, excelTokens),
  ]);

  const directMatches = [];
  for (const row of entityCandidates) {
    const score = calculateSimilarity(excelName, row.name);
    if (score >= similarityThreshold) {
      directMatches.push(row);
    }
  }

  const aliasMatchIds = Array.from(
    new Set(
      aliasCandidates
        .filter(
          (row) =>
            row &&
            row[fkColumn] != null &&
            calculateSimilarity(excelName, row.alias_name) >= similarityThreshold,
        )
        .map((row) => row[fkColumn]),
    ),
  );

  const aliasEntities = await fetchEntitiesByIds(entityTable, aliasMatchIds);

  return dedupeById([...directMatches, ...aliasEntities]);
}

async function reconcileSingleName(excelName, config) {
  const rawExcelName = typeof excelName === "string" ? excelName.trim() : "";
  const normalized = normalizeName(rawExcelName);

  if (!rawExcelName || !normalized) {
    return {
      excelName,
      status: STATUS.NEW_REQUIRED,
    };
  }

  const exactMatch = await findExactMatch(config.entityTable, rawExcelName);
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
    rawExcelName,
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
    rawExcelName,
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
