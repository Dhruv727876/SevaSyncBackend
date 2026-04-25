import { z } from "zod";

const needTypeEnum = z.enum(["food", "medical", "shelter"]);
const urgencyEnum = z.enum(["low", "medium", "high", "critical"]);

export const needSchema = z.object({
  village: z.string().min(1),
  need_type: needTypeEnum,
  urgency: urgencyEnum,
  people: z.number().int().nonnegative()
});

function toSafeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function toSafePeople(value, fallback = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

export function sanitizeNeedPayload(raw, options = {}) {
  const fallbackPeople = Number.isFinite(Number(options.fallbackPeople))
    ? Number(options.fallbackPeople)
    : 100;

  const village = toSafeString(raw?.village, "unknown") || "unknown";

  const needTypeRaw = toSafeString(raw?.need_type, "food").toLowerCase();
  const need_type = ["food", "medical", "shelter"].includes(needTypeRaw) ? needTypeRaw : "food";

  const urgencyRaw = toSafeString(raw?.urgency, "low").toLowerCase();
  const urgency = ["low", "medium", "high", "critical"].includes(urgencyRaw) ? urgencyRaw : "low";

  const people = toSafePeople(raw?.people ?? raw?.quantity, fallbackPeople);

  return { village, need_type, urgency, people };
}

export function validateNeedPayload(raw, options = {}) {
  const repaired = sanitizeNeedPayload(raw, options);
  const parsed = needSchema.safeParse(repaired);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(`AI output validation failed: ${firstIssue?.message || "Invalid payload"}`);
  }

  return parsed.data;
}
