import { db, Timestamp } from "../config/firebase.js";
import { logger } from "../config/logger.js";
import { parseNeedFromText } from "../services/groqService.js";
import { parseNeedFromImage } from "../services/imageAIService.js";
import { generatePriorityScore } from "../services/priorityService.js";

function formatNeed(docData) {
  return {
    ...docData,
    created_at: docData.created_at?.toDate ? docData.created_at.toDate().toISOString() : docData.created_at
  };
}

function buildNeedPayload(docRefId, need) {
  return {
    id: docRefId,
    village: need.village,
    need_type: need.need_type,
    urgency: need.urgency,
    people: need.people,
    priority_score: generatePriorityScore(need.urgency),
    created_at: Timestamp.now()
  };
}

export async function parseTextAndCreateNeed(req, res) {
  try {
    const parsedNeed = await parseNeedFromText(req.body.text, { requestId: req.id });

    const docRef = db.collection("needs").doc();
    const payload = buildNeedPayload(docRef.id, parsedNeed);

    await docRef.set(payload);

    logger.info({
      message: "Need created from parsed text",
      requestId: req.id,
      route: req.originalUrl,
      id: payload.id,
      urgency: payload.urgency
    });

    return res.status(201).json(formatNeed(payload));
  } catch (error) {
    logger.error({
      message: "Failed to parse text/create need",
      requestId: req.id,
      route: req.originalUrl,
      error: error.message
    });
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

export async function parseImageAndCreateNeed(req, res) {
  try {
    const parsedNeed = await parseNeedFromImage(req.file.buffer, req.file.mimetype, {
      requestId: req.id
    });

    const docRef = db.collection("needs").doc();
    const payload = buildNeedPayload(docRef.id, parsedNeed);

    await docRef.set(payload);

    logger.info({
      message: "Need created from parsed image",
      requestId: req.id,
      route: req.originalUrl,
      id: payload.id,
      urgency: payload.urgency
    });

    return res.status(201).json(formatNeed(payload));
  } catch (error) {
    logger.error({
      message: "Failed to parse image/create need",
      requestId: req.id,
      route: req.originalUrl,
      error: error.message
    });
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

function encodeCursor(createdAtMs) {
  return Buffer.from(String(createdAtMs)).toString("base64url");
}

function decodeCursor(rawCursor) {
  if (!rawCursor) return null;

  try {
    const decoded = Buffer.from(String(rawCursor), "base64url").toString("utf8");
    const createdAtMs = Number(decoded);
    return Number.isFinite(createdAtMs) ? createdAtMs : null;
  } catch {
    return null;
  }
}

export async function getAllNeeds(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const decodedCursor = decodeCursor(req.query.cursor);

    let query = db.collection("needs").orderBy("created_at", "desc").limit(safeLimit);

    if (decodedCursor !== null) {
      query = query.startAfter(Timestamp.fromMillis(decodedCursor));
    }

    const snapshot = await query.get();
    const data = snapshot.docs.map((doc) => formatNeed(doc.data()));

    let next_cursor = null;
    const last = data[data.length - 1];
    if (last?.created_at) {
      const lastCreatedAtMs = new Date(last.created_at).getTime();
      if (Number.isFinite(lastCreatedAtMs)) {
        next_cursor = encodeCursor(lastCreatedAtMs);
      }
    }

    if (String(req.query.format || "modern") === "legacy") {
      return res.status(200).json(data);
    }

    return res.status(200).json({ data, next_cursor });
  } catch (error) {
    logger.error({
      message: "Failed to fetch needs",
      requestId: req.id,
      route: req.originalUrl,
      error: error.message
    });
    return res.status(500).json({ error: "Failed to fetch needs" });
  }
}

export async function getNeedById(needId) {
  const doc = await db.collection("needs").doc(needId).get();
  if (!doc.exists) return null;
  return doc.data();
}

