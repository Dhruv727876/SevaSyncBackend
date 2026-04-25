import { Router } from "express";
import { matchVolunteers } from "../controllers/volunteerController.js";
import { validateMatchVolunteersRequest } from "../middleware/validation.js";

const router = Router();

router.post("/match-volunteers", validateMatchVolunteersRequest, matchVolunteers);

export default router;
