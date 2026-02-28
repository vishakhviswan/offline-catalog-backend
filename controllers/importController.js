const reconcileImport = async (req, res) => {
  try {
    res.json({ message: "Import route working" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { reconcileImport };
