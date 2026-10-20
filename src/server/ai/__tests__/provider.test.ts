import { expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { OLLAMA_BASE_URL: "http://127.0.0.1:11434" },
}));
import { resolveProvider } from "../provider";

it("selects the configured local Ollama provider without paid API keys", async () => {
  const provider = resolveProvider();
  expect(provider?.id).toBe("ollama");
  expect(provider?.model).toBe("llama3.1");
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "local answer" } }] }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  try {
    const result = await provider!.chat(
      [{ role: "user", content: "test" }],
      [],
    );
    expect(fetch.mock.calls[0][0]).toBe(
      "http://127.0.0.1:11434/v1/chat/completions",
    );
    expect(result.content).toBe("local answer");
  } finally {
    vi.unstubAllGlobals();
  }
});
