import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const NODE_ENV = process.env.NODE_ENV?.trim() || "development";
const isProduction = NODE_ENV === "production";

function getTrimmed(name) {
  const raw = process.env[name];
  return typeof raw === "string" ? raw.trim() : "";
}

function requireValue(name, message) {
  const value = getTrimmed(name);
  if (!value) {
    throw new Error(message || `${name} is required`);
  }
  return value;
}

function toNumber(name, fallback) {
  const value = Number(getTrimmed(name));
  return Number.isFinite(value) ? value : fallback;
}

function toBoolean(name, fallback = false) {
  const raw = getTrimmed(name).toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

const groqApiKey = requireValue("GROQ_API_KEY", "GROQ_API_KEY is required");

const llamaApiKey = getTrimmed("LLAMA_API_KEY") || getTrimmed("OPENROUTER_API_KEY");
if (!llamaApiKey) {
  throw new Error("LLAMA_API_KEY (or OPENROUTER_API_KEY) is required");
}

const llamaApiUrl = requireValue("LLAMA_API_URL", "LLAMA_API_URL is required");

let firebaseConfigRaw = getTrimmed("FIREBASE_CONFIG");
const localServiceAccountPath = path.resolve(process.cwd(), "serviceAccount.json");
const hasLocalServiceAccount = fs.existsSync(localServiceAccountPath);

if (firebaseConfigRaw) {
  try {
    JSON.parse(firebaseConfigRaw);
  } catch {
    if (isProduction || !hasLocalServiceAccount) {
      throw new Error("FIREBASE_CONFIG must be valid JSON");
    }
    firebaseConfigRaw = "";
  }
}

if (isProduction && !firebaseConfigRaw) {
  throw new Error("FIREBASE_CONFIG is required in production");
}
if (!firebaseConfigRaw && !hasLocalServiceAccount) {
  throw new Error("FIREBASE_CONFIG is missing and serviceAccount.json was not found");
}

const apiAuthKey = getTrimmed("API_AUTH_KEY");
if (isProduction && !apiAuthKey) {
  throw new Error("API_AUTH_KEY is required in production");
}

const corsOrigin = getTrimmed("CORS_ORIGIN");
if (isProduction && !corsOrigin) {
  throw new Error("CORS_ORIGIN is required in production");
}

export const env = {
  nodeEnv: NODE_ENV,
  isProduction,
  port: toNumber("PORT", 5000),
  groqApiKey,
  groqModel: getTrimmed("GROQ_TEXT_MODEL") || "llama-3.1-8b-instant",
  groqTimeoutMs: toNumber("GROQ_TIMEOUT_MS", 15000),
  groqMaxRetries: toNumber("GROQ_MAX_RETRIES", 2),
  llamaApiKey,
  llamaApiUrl,
  openrouterSiteUrl: getTrimmed("OPENROUTER_SITE_URL") || "http://localhost:5173",
  openrouterTimeoutMs: toNumber("OPENROUTER_TIMEOUT_MS", 20000),
  openrouterMaxRetries: toNumber("OPENROUTER_MAX_RETRIES", 2),
  firebaseConfigRaw,
  hasLocalServiceAccount,
  localServiceAccountPath,
  apiAuthKey,
  corsOrigin,
  aiRateLimitMax: toNumber("AI_RATE_LIMIT_MAX", 20),
  globalRateLimitMax: toNumber("GLOBAL_RATE_LIMIT_MAX", 120),
  idempotencyTtlMs: toNumber("IDEMPOTENCY_TTL_MS", 10 * 60 * 1000),
  aiCircuitFailureThreshold: toNumber("AI_CIRCUIT_FAILURE_THRESHOLD", 5),
  aiCircuitCooldownMs: toNumber("AI_CIRCUIT_COOLDOWN_MS", 30 * 1000),
  useFirestoreVolunteers: toBoolean("USE_VOLUNTEERS_FROM_FIRESTORE", false)
};
