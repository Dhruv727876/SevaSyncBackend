export class CircuitBreaker {
  constructor({ failureThreshold = 5, cooldownMs = 30000, onOpen } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.failureCount = 0;
    this.openUntil = 0;
    this.onOpen = typeof onOpen === "function" ? onOpen : null;
  }

  isOpen() {
    return Date.now() < this.openUntil;
  }

  async execute(action) {
    if (this.isOpen()) {
      throw new Error("AI circuit breaker is open");
    }

    try {
      const result = await action();
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount += 1;
      if (this.failureCount >= this.failureThreshold) {
        this.openUntil = Date.now() + this.cooldownMs;
        if (this.onOpen) {
          this.onOpen();
        }
      }
      throw error;
    }
  }
}
