import { describe, expect, it } from "vitest";
import crypto from "crypto";
import { verifyStripeSignature } from "./stripe";

describe("stripe signature", () => {
  it("accepts a valid signature within the window", () => {
    const secret = "whsec_test";
    const payload = JSON.stringify({ id: "evt_1" });
    const t = Math.floor(Date.now() / 1000);
    const signed = `${t}.${payload}`;
    const v1 = crypto.createHmac("sha256", secret).update(signed).digest("hex");
    const header = `t=${t},v1=${v1}`;
    expect(verifyStripeSignature(payload, header, secret, t)).toBe(true);
  });

  it("rejects an old timestamp", () => {
    const secret = "whsec_test";
    const payload = "{}";
    const t = Math.floor(Date.now() / 1000) - 600;
    const v1 = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    expect(verifyStripeSignature(payload, `t=${t},v1=${v1}`, secret)).toBe(false);
  });
});
