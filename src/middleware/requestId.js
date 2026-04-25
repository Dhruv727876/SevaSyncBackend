import { randomUUID } from "crypto";

export function requestIdMiddleware(req, res, next) {
  req.id = randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
}
