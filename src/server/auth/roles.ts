export type Role = "OWNER" | "ADMIN" | "ANALYST" | "VIEWER";

export const roleHierarchy: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  ANALYST: 2,
  VIEWER: 1
};

export function can(role: Role, required: Role): boolean {
  return roleHierarchy[role] >= roleHierarchy[required];
}

export async function requireRole(required: Role, current?: Role) {
  if (!current || !can(current, required)) {
    throw new Error("Unauthorized");
  }
  return true;
}
