function write(level, messageOrPayload, meta = {}) {
  const base = {
    level,
    time: new Date().toISOString()
  };

  const payload =
    typeof messageOrPayload === "object" && messageOrPayload !== null
      ? { ...base, ...messageOrPayload }
      : { ...base, message: String(messageOrPayload), ...meta };

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  info(messageOrPayload, meta = {}) {
    write("info", messageOrPayload, meta);
  },
  warn(messageOrPayload, meta = {}) {
    write("warn", messageOrPayload, meta);
  },
  error(messageOrPayload, meta = {}) {
    write("error", messageOrPayload, meta);
  }
};
