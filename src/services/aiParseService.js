import { logger } from "../config/logger.js";
import { validateNeedPayload } from "./needSchemaService.js";

function stripCodeFence(text) {
  return String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
}

function extractFirstJsonBlock(text) {
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    throw new Error("No JSON object found in AI response");
  }
  return objectMatch[0];
}

export function parseAiNeedPayload(rawText, context = {}) {
  const cleaned = stripCodeFence(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    const validated = validateNeedPayload(parsed, { fallbackPeople: 100 });
    logger.info({
      message: "AI payload parsed",
      requestId: context.requestId,
      parse_mode: "strict"
    });
    return validated;
  } catch {
    try {
      const extracted = extractFirstJsonBlock(cleaned);
      const parsed = JSON.parse(extracted);
      const validated = validateNeedPayload(parsed, { fallbackPeople: 100 });
      logger.info({
        message: "AI payload parsed",
        requestId: context.requestId,
        parse_mode: "extracted"
      });
      return validated;
    } catch (error) {
      logger.error({
        message: "AI payload parsing failed",
        requestId: context.requestId,
        parse_mode: "fallback",
        error: error.message
      });
      return {
        village: "unknown",
        need_type: "food",
        urgency: "low",
        people: 100
      };
    }
  }
}

export function parseAiArray(rawText) {
  const cleaned = stripCodeFence(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // continue to regex extraction
  }

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error("No JSON array found in AI response");
  }

  const parsed = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error("Parsed explanation payload is not an array");
  }

  return parsed;
}
