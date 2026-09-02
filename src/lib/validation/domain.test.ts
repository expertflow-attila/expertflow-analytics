import { describe, expect, it } from "vitest";
import { currencySchema, onboardingSchema, slugify, timezoneSchema } from "./domain";
describe("domain validation", () => {
  it("normalizes readable slugs", () => expect(slugify("Business Native Áttekintés")).toBe("business-native-attekintes"));
  it("rejects invalid timezones", () => expect(timezoneSchema.safeParse("Budapest-ish").success).toBe(false));
  it("accepts ISO currencies only", () => { expect(currencySchema.safeParse("HUF").success).toBe(true); expect(currencySchema.safeParse("Ft").success).toBe(false); });
  it("validates onboarding boundaries", () => expect(onboardingSchema.safeParse({ organizationName: "Acme", organizationTimezone: "UTC", projectName: "Main Funnel", projectTimezone: "Europe/Budapest", baseCurrency: "EUR" }).success).toBe(true));
});

