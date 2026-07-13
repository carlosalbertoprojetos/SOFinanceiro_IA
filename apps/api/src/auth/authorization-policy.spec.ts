import { describe, expect, it } from "vitest";

import { AuthorizationPolicy } from "./authorization-policy";

describe("AuthorizationPolicy", () => {
  const policy = new AuthorizationPolicy();
  const mutationRoles = ["OWNER", "ADMIN"] as const;

  it.each(["OWNER", "ADMIN"] as const)(
    "allows %s for a representative mutation policy",
    (role) => {
      expect(policy.isAllowed(role, [...mutationRoles])).toBe(true);
    },
  );

  it("allows MEMBER for a representative read policy", () => {
    expect(policy.isAllowed("MEMBER", ["OWNER", "ADMIN", "MEMBER"])).toBe(true);
  });

  it("rejects MEMBER for a representative mutation policy", () => {
    expect(() => policy.assertAllowed("MEMBER", [...mutationRoles])).toThrow(
      "Operation not permitted",
    );
  });
});
