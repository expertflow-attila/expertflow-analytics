import { z } from "zod";

const validTimezones = new Set(Intl.supportedValuesOf("timeZone"));
export const timezoneSchema = z.string().refine((value) => value === "UTC" || validTimezones.has(value), "Invalid IANA timezone");
export const currencySchema = z.string().length(3).regex(/^[A-Z]{3}$/, "Use an ISO 4217 currency code");
export const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "workspace";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(128),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
export const onboardingSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationTimezone: timezoneSchema,
  projectName: z.string().trim().min(2).max(120),
  projectTimezone: timezoneSchema,
  baseCurrency: currencySchema,
});
export const updateProjectSchema = z.object({ name: z.string().trim().min(2).max(120), timezone: timezoneSchema, baseCurrency: currencySchema });
export const updateOrganizationSchema = z.object({ name: z.string().trim().min(2).max(120), timezone: timezoneSchema });

