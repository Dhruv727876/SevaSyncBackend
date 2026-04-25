import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { db } from "./config/firebase.js";
import { logger } from "./config/logger.js";
import { requireApiKey } from "./middleware/auth.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { getMetrics } from "./services/metricsService.js";
import needRoutes from "./routes/needRoutes.js";
import volunteerRoutes from "./routes/volunteerRoutes.js";

const app = express();
app.set("trust proxy", 1);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.aiRateLimitMax > 0 ? env.aiRateLimitMax : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again in a minute." }
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.globalRateLimitMax > 0 ? env.globalRateLimitMax : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
});

const devAllowedOrigins = new Set(["http://localhost:5173", "http://localhost:3000"]);

function corsOriginResolver(origin, callback) {
  if (!origin) return callback(null, true);
  
  const allowed = env.corsOrigin?.toLowerCase();
  const incoming = origin?.toLowerCase();
  
  if (allowed && incoming === allowed) {
    return callback(null, origin);
  }

  if (!env.isProduction) {
    if (devAllowedOrigins.has(origin)) {
      return callback(null, true);
    }
  }

  return callback(new Error("CORS origin not allowed"));
}

app.use(cors({ origin: corsOriginResolver, credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.use(requestIdMiddleware);
app.use(globalLimiter);
app.use(requireApiKey);

app.use("/parse-text", aiLimiter);
app.use("/analyze-image", aiLimiter);
app.use("/match-volunteers", aiLimiter);

app.get("/", (_req, res) => {
  res.status(200).send("Server running");
});

async function withTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

app.get("/health", async (_req, res) => {
  let firebase = false;

  try {
    await withTimeout(db.collection("needs").limit(1).get(), 1500);
    firebase = true;
  } catch {
    firebase = false;
  }

  const groq = Boolean(env.groqApiKey);
  const llama = Boolean(env.llamaApiKey && env.llamaApiUrl);

  return res.status(200).json({
    status: "ok",
    firebase,
    groq,
    llama,
    env_valid: true
  });
});

app.get("/metrics", (_req, res) => {
  return res.status(200).json(getMetrics());
});

app.use("/", needRoutes);
app.use("/", volunteerRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large. Maximum size is 5MB." });
  }
  if (err.message === "Invalid file type" || err.message === "Only image files are allowed") {
    return res.status(400).json({ error: "Only image files are allowed." });
  }
  if (err.message === "CORS origin not allowed") {
    return res.status(403).json({ error: "CORS origin denied" });
  }

  logger.error({
    message: "Unhandled server error",
    requestId: req?.id,
    route: req?.originalUrl,
    error: err.message
  });

  return res.status(500).json({ error: "Internal server error." });
});

app.listen(env.port, () => {
  logger.info({
    message: "SevaSync backend running",
    port: env.port,
    nodeEnv: env.nodeEnv,
    aiRateLimitMax: env.aiRateLimitMax,
    apiKeyAuthEnabled: Boolean(env.apiAuthKey)
  });
});
