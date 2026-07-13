import type { MembershipRole } from "../generated/prisma/enums";

export type AuthenticatedPrincipal = {
  userId: string;
  issuer: string;
  subject: string;
};

export type TenantContext = {
  companyId: string;
  membershipId: string;
  role: MembershipRole;
  userId: string;
};

export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  principal?: AuthenticatedPrincipal;
  tenantContext?: TenantContext;
};
