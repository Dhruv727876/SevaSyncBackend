import { createHash } from "crypto";
import { Timestamp, db } from "../config/firebase.js";
import { logger } from "../config/logger.js";
import { incrementMetric } from "../services/metricsService.js";

const COLLECTION = "idempotency_keys";

function buildDocId(compositeKey) {
  return createHash("sha256").update(compositeKey).digest("hex");
}

export function createIdempotencyMiddleware(ttlMs = 10 * 60 * 1000) {
  return async function idempotencyMiddleware(req, res, next) {
    const idempotencyKey = req.header("x-idempotency-key")?.trim();
    if (!idempotencyKey) {
      return next();
    }

    const compositeKey = `${req.method}:${req.path}:${idempotencyKey}`;
    const docId = buildDocId(compositeKey);
    const now = Date.now();

    try {
      const docRef = db.collection(COLLECTION).doc(docId);
      const snapshot = await docRef.get();

      if (snapshot.exists) {
        const stored = snapshot.data();
        const expiresAtMs = stored?.expires_at?.toMillis ? stored.expires_at.toMillis() : 0;

        if (expiresAtMs > now && stored?.response) {
          incrementMetric("idempotency_hits", 1);
          return res.status(stored.status_code || 200).json(stored.response);
        }

        if (expiresAtMs <= now) {
          docRef.delete().catch(() => {});
        }
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const payload = {
            key: compositeKey,
            response: body,
            status_code: res.statusCode,
            created_at: Timestamp.now(),
            expires_at: Timestamp.fromMillis(now + ttlMs)
          };

          docRef.set(payload).catch((error) => {
            logger.error({
              message: "Failed to persist idempotency key",
              requestId: req.id,
              route: req.originalUrl,
              error: error.message
            });
          });
        }

        return originalJson(body);
      };

      return next();
    } catch (error) {
      logger.error({
        message: "Idempotency middleware failed",
        requestId: req.id,
        route: req.originalUrl,
        error: error.message
      });

      return next();
    }
  };
}
