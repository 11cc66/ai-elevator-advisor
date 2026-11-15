import { describe, expect, it } from "vitest";

import {
  WORKER_SERVICE_NAME,
  getWorkerIdentity,
} from "../src/worker-identity.js";

describe("worker identity", () => {
  it("uses a stable service name for logs and PostgreSQL connections", () => {
    expect(getWorkerIdentity()).toEqual({ service: WORKER_SERVICE_NAME });
  });
});
