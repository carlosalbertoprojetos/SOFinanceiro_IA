import { SetMetadata } from "@nestjs/common";

import type { MembershipRole } from "../generated/prisma/enums";

export const ALLOWED_ROLES_METADATA = "auth.allowedRoles";

export const AllowedRoles = (
  ...roles: MembershipRole[]
): ClassDecorator & MethodDecorator =>
  SetMetadata(ALLOWED_ROLES_METADATA, roles);
