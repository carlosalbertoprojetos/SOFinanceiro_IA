import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

import { safeReturnTo } from "./safe-return-to";

const audience = process.env.AUTH0_AUDIENCE;
const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

export const auth0Options = {
  appBaseUrl: process.env.APP_BASE_URL,
  authorizationParameters: {
    ...(audience ? { audience } : {}),
    scope: "openid profile email offline_access",
  },
  enableAccessTokenEndpoint: false,
  onCallback: async (error, context) =>
    NextResponse.redirect(
      new URL(error ? "/auth/error" : safeReturnTo(context.returnTo), baseUrl),
    ),
  session: {
    absoluteDuration: 60 * 60 * 24 * 7,
    cookie: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    inactivityDuration: 60 * 60 * 24,
    rolling: true,
  },
  signInReturnToPath: "/companies",
  tokenRefreshBuffer: 60,
} satisfies NonNullable<ConstructorParameters<typeof Auth0Client>[0]>;

let client: Auth0Client | undefined;

export function getAuth0Client(): Auth0Client {
  client ??= new Auth0Client(auth0Options);
  return client;
}
