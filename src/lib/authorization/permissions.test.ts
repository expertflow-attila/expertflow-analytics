import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";
describe("RBAC", () => {
  it("keeps viewers read-only", () => { expect(hasPermission("VIEWER", "analytics:read")).toBe(true); expect(hasPermission("VIEWER", "project:manage")).toBe(false); });
  it("allows admins to manage projects, not delete organizations", () => { expect(hasPermission("ADMIN", "project:manage")).toBe(true); expect(hasPermission("ADMIN", "organization:delete")).toBe(false); });
  it("allows owners to manage the organization", () => { expect(hasPermission("OWNER", "organization:delete")).toBe(true); });
});

