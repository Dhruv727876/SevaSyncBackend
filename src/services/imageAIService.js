import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { CircuitBreaker } from "./circuitBreaker.js";
import { incrementMetric } from "./metricsService.js";
import { parseAiNeedPayload } from "./aiParseService.js";

const breaker = new CircuitBreaker({
  failureThreshold: env.aiCircuitFailureThreshold,
  cooldownMs: env.aiCircuitCooldownMs,
  onOpen: () => incrementMetric("breaker_open_count", 1)
});

async function requestWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function parseNeedFromImage(imageBuffer, mimeType = "image/jpeg", context = {}) {
  incrementMetric("ai_requests_total", 1);

  const base64Image = imageBuffer.toString("base64");
  let lastError;

  for (let attempt = 1; attempt <= env.openrouterMaxRetries; attempt += 1) {
    try {
      const response = await breaker.execute(() =>
        requestWithTimeout(
          env.llamaApiUrl,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.llamaApiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": env.openrouterSiteUrl,
              "X-Title": "SevaSync"
            },
            body: JSON.stringify({
              model: "meta-llama/llama-4-scout-17b-16e-instruct",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analyze the image and return ONLY JSON with keys village, need_type(food|medical|shelter), urgency(low|medium|high|critical), people(number)."
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimeType};base64,${base64Image}`
                      }
                    }
                  ]
                }
              ]
            })
          },
          env.openrouterTimeoutMs
        )
      );

      const raw = await response.text();
      let data;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Invalid JSON response from OpenRouter");
      }

      if (!response.ok) {
        throw new Error(data?.error?.message || `OpenRouter request failed (${response.status})`);
      }

      const output = data?.choices?.[0]?.message?.content;
      if (!output) {
        throw new Error("Invalid response from image model");
      }

      return parseAiNeedPayload(output, context);
    } catch (error) {
      lastError = error;
      incrementMetric("ai_failures_total", 1);
      logger.error({
        message: "OpenRouter image parse attempt failed",
        requestId: context.requestId,
        attempt,
        error: error.message
      });
    }
  }

  logger.error({
    message: "Llama parse failed, returning fallback",
    requestId: context.requestId,
    error: lastError?.message
  });

  return {
    village: "unknown",
    need_type: "food",
    urgency: "low",
    people: 100
  };
}
