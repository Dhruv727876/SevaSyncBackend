import { env } from "../config/env.js";
import { db } from "../config/firebase.js";
import { logger } from "../config/logger.js";
import { staticVolunteers } from "../data/volunteers.js";

let cachedVolunteers = null;
let cacheLoaded = false;

async function getVolunteerSource() {
  if (!env.useFirestoreVolunteers) {
    return staticVolunteers;
  }

  if (cacheLoaded && Array.isArray(cachedVolunteers)) {
    return cachedVolunteers;
  }

  try {
    const snapshot = await db.collection("volunteers").where("available", "==", true).get();
    const fromFirestore = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (fromFirestore.length > 0) {
      cachedVolunteers = fromFirestore;
      cacheLoaded = true;
      return cachedVolunteers;
    }
  } catch (error) {
    logger.warn({ message: "Firestore volunteer loader failed; using static dataset", error: error.message });
  }

  cachedVolunteers = staticVolunteers;
  cacheLoaded = true;
  return cachedVolunteers;
}

const DISTANCE_MATRIX = {
  kamrup: { kamrup: 0, nagaon: 115, dibrugarh: 430 },
  nagaon: { nagaon: 0, kamrup: 115, dibrugarh: 320 },
  dibrugarh: { dibrugarh: 0, kamrup: 430, nagaon: 320 }
};

const NEED_KEYWORDS = {
  food: ["food", "ration", "nutrition", "kitchen", "supply"],
  medical: ["medical", "first-aid", "nursing", "triage", "ambulance"],
  shelter: ["shelter", "rescue", "evacuation", "camp", "housing"]
};

function estimateDistanceKm(needVillage, volunteerDistrict) {
  const from = String(needVillage || "").toLowerCase();
  const to = String(volunteerDistrict || "").toLowerCase();

  if (!from || from === "unknown") return 150;
  if (DISTANCE_MATRIX[from]?.[to] !== undefined) return DISTANCE_MATRIX[from][to];
  if (from === to) return 0;

  return 250;
}

function getSkillScore(needType, skills) {
  const need = String(needType || "").toLowerCase();
  const keywords = NEED_KEYWORDS[need] || [need];

  const hasDirectMatch = skills.some((skill) => {
    const normalized = String(skill).toLowerCase();
    return need.includes(normalized) || normalized.includes(need);
  });

  const keywordMatches = skills.filter((skill) => {
    const normalized = String(skill).toLowerCase();
    return keywords.some((keyword) => normalized.includes(keyword) || keyword.includes(normalized));
  }).length;

  if (hasDirectMatch) return 60;
  return Math.min(keywordMatches * 18, 55);
}

function getUrgencyScore(urgency) {
  const value = String(urgency || "low").toLowerCase();
  if (value === "critical") return 30;
  if (value === "high") return 20;
  if (value === "medium") return 10;
  return 0;
}

function getPeopleScore(people) {
  const count = Number(people) || 0;
  if (count > 200) return 20;
  if (count > 100) return 10;
  return 0;
}

function scoreVolunteer(volunteer, need) {
  if (!volunteer.available) return null;

  const needType = String(need.need_type || "").toLowerCase();
  const needVillage = String(need.village || "").toLowerCase();
  const urgency = String(need.urgency || "low").toLowerCase();

  const skill = getSkillScore(needType, volunteer.skills || []);
  const distanceKm = estimateDistanceKm(needVillage, volunteer.district);
  const distance = Math.max(0, 30 - distanceKm * 0.08);
  const urgencyScore = getUrgencyScore(urgency);
  const people = getPeopleScore(need.people);
  const districtBoost = String(volunteer.district || "").toLowerCase() === needVillage ? 15 : 0;
  const rating = Number(volunteer.rating || 0) * 5;

  let urgencyBonus = 0;
  if (urgency === "critical") {
    urgencyBonus += Number(volunteer.rating || 0) * 10;
    urgencyBonus += Math.max(0, 50 - distanceKm * 0.2);
  } else if (urgency === "high") {
    urgencyBonus += Number(volunteer.rating || 0) * 5;
  }

  const total = Number((skill + distance + urgencyScore + people + districtBoost + rating + urgencyBonus).toFixed(2));

  return {
    total,
    breakdown: {
      skill,
      distance,
      urgency: urgencyScore,
      people,
      district: districtBoost,
      rating,
      urgency_bonus: Number(urgencyBonus.toFixed(2)),
      distance_km: distanceKm
    }
  };
}

export async function matchVolunteersForNeed(need, topN = 3) {
  try {
    const volunteers = await getVolunteerSource();

    return volunteers
      .map((volunteer) => {
        const scored = scoreVolunteer(volunteer, need);
        if (!scored) return null;

        return {
          ...volunteer,
          score: scored.total,
          match_score: scored.total,
          score_breakdown: scored.breakdown
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.id).localeCompare(String(b.id));
      })
      .slice(0, topN);
  } catch (error) {
    logger.error({ message: "Volunteer matching computation failed", error: error.message });
    return [];
  }
}
