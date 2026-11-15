import pino from "pino";

import { readWebEnv } from "./env";

const env = readWebEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "elevator-web",
  },
  redact: {
    paths: [
      "password",
      "secret",
      "token",
      "authorization",
      "cookie",
      "DATABASE_URL",
      "*.password",
      "*.secret",
      "*.token",
      "*.authorization",
      "*.cookie",
      "*.DATABASE_URL",
    ],
    censor: "[REDACTED]",
  },
});
