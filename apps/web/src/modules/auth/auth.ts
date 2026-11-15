import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";

import { prisma } from "@/server/prisma";
import { readWebEnv } from "@/server/env";

const env = readWebEnv();

export const auth = betterAuth({
  appName: "AI Elevator Advisor",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 15,
  },
  trustedOrigins: [env.BETTER_AUTH_URL],
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 64,
      immutableUsername: true,
    }),
    nextCookies(),
  ],
});
