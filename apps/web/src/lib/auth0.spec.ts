import { describe, expect, it } from "vitest";

import { auth0Options } from "./auth0";

describe("Auth0 server session configuration", () => {
  it("uses an encrypted server session contract and disables browser token access", () => {
    expect(auth0Options).toMatchObject({
      enableAccessTokenEndpoint: false,
      session: {
        absoluteDuration: 604800,
        cookie: { sameSite: "lax" },
        inactivityDuration: 86400,
        rolling: true,
      },
      tokenRefreshBuffer: 60,
    });
  });

  it("requests the API access-token audience and offline renewal scope", () => {
    expect(auth0Options.authorizationParameters?.scope).toContain(
      "offline_access",
    );
  });
});
