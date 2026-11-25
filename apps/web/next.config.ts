import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import {
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appDirectory, "../..");

function isolatedDistDir(): string | undefined {
  const value = process.env.P13_NEXT_DIST_DIR;
  if (value === undefined) {
    return undefined;
  }
  if (
    !/^\.p13-releases\/[A-Za-z0-9._-]+$/.test(value) ||
    value.includes("..")
  ) {
    throw new Error("P13_NEXT_DIST_DIR must be an isolated release directory");
  }
  return value;
}

function isolatedTsconfigPath(): string | undefined {
  const value = process.env.P13_NEXT_TSCONFIG_PATH;
  if (value === undefined) {
    return undefined;
  }
  if (
    !/^\.p13-build\/[A-Za-z0-9._-]+\/tsconfig\.json$/.test(value) ||
    value.includes("..")
  ) {
    throw new Error("P13_NEXT_TSCONFIG_PATH must be isolated");
  }
  return value;
}

export default function nextConfig(phase: string): NextConfig {
  const distDir = isolatedDistDir();
  const tsconfigPath = isolatedTsconfigPath();
  if (
    (phase === PHASE_PRODUCTION_BUILD ||
      phase === PHASE_PRODUCTION_SERVER) &&
    !distDir
  ) {
    throw new Error(
      "P13_NEXT_DIST_DIR is required for production build or start",
    );
  }

  return {
    agentRules: false,
    distDir,
    outputFileTracingRoot: workspaceRoot,
    poweredByHeader: false,
    reactStrictMode: true,
    typescript: tsconfigPath ? { tsconfigPath } : undefined,
    transpilePackages: [
      "@elevator/build-integrity",
      "@elevator/contracts",
      "@elevator/file-storage",
      "@elevator/shared-ui",
    ],
  };
};
