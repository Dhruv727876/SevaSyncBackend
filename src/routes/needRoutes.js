import { Router } from "express";
import { getAllNeeds, parseImageAndCreateNeed, parseTextAndCreateNeed } from "../controllers/needController.js";
import { createIdempotencyMiddleware } from "../middleware/idempotency.js";
import upload from "../middleware/upload.js";
import {
  validateAnalyzeImageRequest,
  validateNeedsQuery,
  validateParseTextRequest
} from "../middleware/validation.js";
import { env } from "../config/env.js";

const router = Router();
const idempotencyMiddleware = createIdempotencyMiddleware(env.idempotencyTtlMs);

router.post("/parse-text", idempotencyMiddleware, validateParseTextRequest, parseTextAndCreateNeed);
router.post(
  "/analyze-image",
  idempotencyMiddleware,
  upload.single("image"),
  validateAnalyzeImageRequest,
  parseImageAndCreateNeed
);
router.get("/needs", validateNeedsQuery, getAllNeeds);

export default router;
