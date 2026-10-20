import { describe, expect, it } from "vitest";
import { timezoneSchema, currencySchema } from "../config-validation";

describe("configuration boundaries", () => {
  it.each(["UTC", "Europe/Budapest", "America/New_York"])(
    "accepts real timezone %s",
    (value) => expect(timezoneSchema.safeParse(value).success).toBe(true),
  );
  it.each(["not-a-timezone", "", "Europe/Nonexistent"])(
    "rejects timezone %s before any database write",
    (value) => expect(timezoneSchema.safeParse(value).success).toBe(false),
  );
  it.each(["EUR", "HUF", "USD"])("accepts ISO currency %s", (value) =>
    expect(currencySchema.safeParse(value).success).toBe(true),
  );
  it.each(["abc", "€", "123"])("rejects invalid currency %s", (value) =>
    expect(currencySchema.safeParse(value).success).toBe(false),
  );
});
