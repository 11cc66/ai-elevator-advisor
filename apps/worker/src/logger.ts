import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "elevator-worker",
  },
  redact: {
    paths: [
      "password",
      "secret",
      "token",
      "DATABASE_URL",
      "*.password",
      "*.secret",
      "*.token",
      "*.DATABASE_URL",
    ],
    censor: "[REDACTED]",
  },
});
