import { z } from "zod";

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("hu", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Adj meg érvényes IANA-időzónát, például Europe/Budapest.");

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (value) => Intl.supportedValuesOf("currency").includes(value),
    "Adj meg érvényes ISO-pénznemet, például EUR vagy HUF.",
  );
