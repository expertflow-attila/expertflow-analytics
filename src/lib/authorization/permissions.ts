import type { MembershipRole } from "@/db/schema";

export type Permission = "organization:manage" | "project:manage" | "analytics:read" | "members:manage" | "organization:delete";
const permissions: Record<MembershipRole, readonly Permission[]> = {
  OWNER: ["organization:manage", "project:manage", "analytics:read", "members:manage", "organization:delete"],
  ADMIN: ["project:manage", "analytics:read", "members:manage"],
  ANALYST: ["analytics:read"],
  VIEWER: ["analytics:read"],
};
export const hasPermission = (role: MembershipRole, permission: Permission) => permissions[role].includes(permission);

