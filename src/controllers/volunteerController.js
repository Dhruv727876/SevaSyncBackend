import { logger } from "../config/logger.js";
import { sanitizeNeedPayload } from "../services/needSchemaService.js";
import { generateVolunteerExplanations } from "../services/groqService.js";
import { matchVolunteersForNeed } from "../services/volunteerService.js";
import { getNeedById } from "./needController.js";

export async function matchVolunteers(req, res) {
  try {
    const need_id = req.body.need_id;
    const need = req.body.need;

    let targetNeed = need ? sanitizeNeedPayload(need, { fallbackPeople: 100 }) : null;

    if (!targetNeed && need_id) {
      const dbNeed = await getNeedById(need_id);
      if (!dbNeed) {
        return res.status(404).json({ error: "Need not found for provided need_id" });
      }
      targetNeed = sanitizeNeedPayload(dbNeed, { fallbackPeople: 100 });
    }

    const matches = await matchVolunteersForNeed(targetNeed, 3);
    const explanations = await generateVolunteerExplanations(matches, targetNeed, {
      requestId: req.id
    });

    const enrichedMatches = matches.map((volunteer, index) => ({
      ...volunteer,
      explanation: explanations[index]
    }));

    return res.status(200).json({
      need: targetNeed,
      matches: enrichedMatches
    });
  } catch (error) {
    logger.error({
      message: "Volunteer matching failed",
      requestId: req.id,
      route: req.originalUrl,
      error: error.message
    });
    return res.status(500).json({ error: "Failed to match volunteers" });
  }
}

