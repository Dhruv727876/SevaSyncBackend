import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { CircuitBreaker } from "./circuitBreaker.js";
import { incrementMetric } from "./metricsService.js";
import { parseAiArray, parseAiNeedPayload } from "./aiParseService.js";

const groq = new Groq({ apiKey: env.groqApiKey });

const breaker = new CircuitBreaker({
  failureThreshold: env.aiCircuitFailureThreshold,
  cooldownMs: env.aiCircuitCooldownMs,
  onOpen: () => incrementMetric("breaker_open_count", 1)
});

function normalizeUrgency(value) {
  const urgency = String(value || "low").toLowerCase();
  if (["urgent", "very urgent", "emergency"].includes(urgency)) return "critical";
  if (urgency === "high") return "high";
  if (urgency === "medium") return "medium";
  if (urgency === "critical") return "critical";
  return "low";
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Groq request timed out")), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function createGroqCompletion(messages, temperature, context = {}) {
  let lastError;

  for (let attempt = 1; attempt <= env.groqMaxRetries; attempt += 1) {
    try {
      return await breaker.execute(() =>
        withTimeout(
          groq.chat.completions.create({
            model: env.groqModel,
            messages,
            temperature
          }),
          env.groqTimeoutMs
        )
      );
    } catch (error) {
      lastError = error;
      incrementMetric("ai_failures_total", 1);
      logger.error({
        message: "Groq request failed",
        requestId: context.requestId,
        attempt,
        error: error.message
      });
    }
  }

  throw lastError || new Error("Groq request failed");
}

export async function parseNeedFromText(text, context = {}) {
  incrementMetric("ai_requests_total", 1);

  try {
    const completion = await createGroqCompletion(
      [
        {
          role: "system",
          content:
            "Extract structured disaster data and return only valid JSON with keys village, need_type, urgency, people."
        },
        {
          role: "user",
          content: `Read this report and return ONLY JSON:\n{\n  "village": "",\n  "need_type": "food|medical|shelter",\n  "urgency": "low|medium|high|critical",\n  "people": 0\n}\nText: "${text}"`
        }
      ],
      0,
      context
    );

    const output = completion?.choices?.[0]?.message?.content;
    if (!output) {
      throw new Error("Empty Groq response");
    }

    const parsed = parseAiNeedPayload(output, context);
    return {
      ...parsed,
      urgency: normalizeUrgency(parsed.urgency)
    };
  } catch (error) {
    incrementMetric("ai_failures_total", 1);
    logger.error({
      message: "Groq parse failed, returning fallback",
      requestId: context.requestId,
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

export async function generateVolunteerExplanations(volunteers, need, context = {}) {
  if (!Array.isArray(volunteers) || volunteers.length === 0) {
    return [];
  }

  incrementMetric("ai_requests_total", 1);

  try {
    const completion = await createGroqCompletion(
      [
        {
          role: "system",
          content:
            "Return only JSON array of short explanations. Match array length exactly to volunteers length in input order."
        },
        {
          role: "user",
          content: `Need: ${JSON.stringify(need)}\nVolunteers: ${JSON.stringify(
            volunteers.map((volunteer) => ({
              id: volunteer.id,
              name: volunteer.name,
              skills: volunteer.skills,
              district: volunteer.district,
              rating: volunteer.rating,
              score: volunteer.score
            }))
          )}\nReturn ONLY JSON array like ["...", "..."]`
        }
      ],
      0.2,
      context
    );

    const output = completion?.choices?.[0]?.message?.content;
    const parsed = parseAiArray(output);

    return volunteers.map((volunteer, index) => {
      const explanation = parsed[index];
      if (typeof explanation === "string" && explanation.trim()) {
        return explanation.trim();
      }
      return `${volunteer.name} is suitable based on skills, availability, and proximity.`;
    });
  } catch (error) {
    incrementMetric("ai_failures_total", 1);
    logger.error({
      message: "Volunteer explanations failed",
      requestId: context.requestId,
      error: error.message
    });

    return volunteers.map(
      (volunteer) => `${volunteer.name} is suitable based on skills, availability, and proximity.`
    );
  }
}
