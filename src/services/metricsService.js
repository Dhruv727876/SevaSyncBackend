const counters = {
  ai_requests_total: 0,
  ai_failures_total: 0,
  idempotency_hits: 0,
  breaker_open_count: 0
};

export function incrementMetric(name, amount = 1) {
  if (!Object.prototype.hasOwnProperty.call(counters, name)) {
    return;
  }

  counters[name] += amount;
}

export function getMetrics() {
  return { ...counters };
}
