const PRIORITY_RANGES = {
  critical: [90, 100],
  high: [70, 89],
  medium: [50, 69],
  low: [30, 49]
};

export function generatePriorityScore(urgency) {
  const key = String(urgency || "low").toLowerCase();
  const range = PRIORITY_RANGES[key] || PRIORITY_RANGES.low;
  const min = range[0];
  const max = range[1];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
