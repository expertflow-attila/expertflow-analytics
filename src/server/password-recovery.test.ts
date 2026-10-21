import { afterEach, expect, it, vi } from "vitest";
import {
  createResetToken,
  hashResetToken,
  sendPasswordResetEmail,
} from "./password-recovery";

vi.mock("@/env", () => ({
  env: {
    RESEND_API_KEY: "re_test_credential",
    EMAIL_FROM: "Business Native <noreply@example.test>",
    NEXT_PUBLIC_APP_URL: "https://analytics.example.test",
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("uses the provider's HTTP contract with a canonical recovery URL", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "provider-message-id" }), {
        status: 200,
      }),
    );
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal("fetch", fetchMock);
  const { token, tokenHash } = createResetToken();
  await sendPasswordResetEmail("owner@example.test", token);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBe("Bearer re_test_credential");
  expect(options.headers["Idempotency-Key"]).toBe(tokenHash);
  const body = JSON.parse(options.body);
  expect(body.text).toContain("\n\n");
  expect(body.from).toBe("Business Native <noreply@example.test>");
  expect(body.to).toEqual(["owner@example.test"]);
  expect(body.text).toContain(
    `https://analytics.example.test/reset-password?token=${token}`,
  );
  expect(body.html).toContain(
    `href="https://analytics.example.test/reset-password?token=${token}"`,
  );
  expect(hashResetToken(token)).toBe(tokenHash);
  expect(log).toHaveBeenCalledWith("password-recovery: email-accepted", {
    messageId: "provider-message-id",
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain(token);
  expect(JSON.stringify(log.mock.calls)).not.toContain("re_test_credential");
});

it("reports provider rejection without exposing provider responses or credentials", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response("sensitive details", { status: 403 })),
  );
  await expect(
    sendPasswordResetEmail("owner@example.test", "e".repeat(64)),
  ).rejects.toThrow("PASSWORD_EMAIL_DELIVERY_FAILED");
});
