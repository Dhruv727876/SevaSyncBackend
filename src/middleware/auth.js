import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export function requireApiKey(req, res, next) {
  const configuredKey = env.apiAuthKey;

  if (!configuredKey && !env.isProduction) {
    return next();
  }

  if (!configuredKey && env.isProduction) {
    logger.error({
      message: "API auth key misconfiguration",
      requestId: req.id,
      route: req.originalUrl,
      method: req.method
    });
    return res.status(500).json({ error: "Server auth configuration error" });
  }

  const incomingKey = req.header("x-api-key")?.trim();
  if (!incomingKey || incomingKey !== configuredKey) {
    logger.warn({
      message: "Unauthorized request",
      requestId: req.id,
      route: req.originalUrl,
      method: req.method
    });
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}
