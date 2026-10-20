import { z } from "zod";

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA timezone, for example Europe/Budapest.");

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (value) => Intl.supportedValuesOf("currency").includes(value),
    "Choose a valid ISO currency, for example EUR or HUF.",
  );
