const VALID_NEED_TYPES = new Set(["food", "medical", "shelter"]);
const VALID_URGENCY = new Set(["low", "medium", "high", "critical"]);

function normalizeNeedInput(need = {}) {
  return {
    village: String(need.village || "unknown").trim(),
    need_type: String(need.need_type || "").toLowerCase().trim(),
    urgency: String(need.urgency || "").toLowerCase().trim(),
    people: Number(need.people)
  };
}

export function validateParseTextRequest(req, res, next) {
  const text = req.body?.text;
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Invalid input: 'text' is required." });
  }

  if (text.length > 4000) {
    return res.status(400).json({ error: "Input text is too long (max 4000 chars)." });
  }

  return next();
}

export function validateAnalyzeImageRequest(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: "Image is required" });
  }

  return next();
}

export function validateNeedsQuery(req, res, next) {
  const { limit, cursor, format } = req.query;

  if (limit !== undefined) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
      return res.status(400).json({ error: "limit must be an integer between 1 and 200" });
    }
  }

  if (cursor !== undefined && typeof cursor !== "string") {
    return res.status(400).json({ error: "cursor must be a string" });
  }

  if (format !== undefined && !["legacy", "modern"].includes(String(format))) {
    return res.status(400).json({ error: "format must be either legacy or modern" });
  }

  return next();
}

export function validateMatchVolunteersRequest(req, res, next) {
  const need_id = req.body?.need_id;
  const need = req.body?.need;

  if (!need_id && !need) {
    return res.status(400).json({ error: "Provide either 'need_id' or 'need' object." });
  }

  if (need && typeof need !== "object") {
    return res.status(400).json({ error: "'need' must be an object." });
  }

  if (typeof need_id === "string" && need_id.trim().length === 0) {
    return res.status(400).json({ error: "'need_id' cannot be empty." });
  }

  if (need && typeof need === "object") {
    const normalized = normalizeNeedInput(need);

    if (normalized.need_type && !VALID_NEED_TYPES.has(normalized.need_type)) {
      return res.status(400).json({ error: "need.need_type must be one of food, medical, shelter" });
    }

    if (normalized.urgency && !VALID_URGENCY.has(normalized.urgency)) {
      return res.status(400).json({ error: "need.urgency must be one of low, medium, high, critical" });
    }

    if (need.people !== undefined && (!Number.isFinite(normalized.people) || normalized.people < 0)) {
      return res.status(400).json({ error: "need.people must be a non-negative number" });
    }
  }

  return next();
}
