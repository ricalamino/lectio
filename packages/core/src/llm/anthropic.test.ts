import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicProvider } from "./anthropic.js";

const apiKey = process.env.ANTHROPIC_API_KEY;
const runLive = Boolean(apiKey);

describe.skipIf(!runLive)("AnthropicProvider (live)", () => {
  const provider = new AnthropicProvider({ apiKey: apiKey! });
  const model = process.env.ANTHROPIC_TEST_MODEL ?? "claude-haiku-4-5-20251001";

  it("returns a text completion", async () => {
    const result = await provider.complete({
      model,
      maxTokens: 64,
      messages: [
        { role: "system", content: "Reply with the single word OK." },
        { role: "user", content: "ping" },
      ],
    });
    expect(result.text.toUpperCase()).toContain("OK");
    expect(result.tokensIn).toBeGreaterThan(0);
    expect(result.tokensOut).toBeGreaterThan(0);
  });

  it("returns validated JSON", async () => {
    const schema = z.object({ ok: z.boolean(), echo: z.string() });
    const result = await provider.completeJson({
      model,
      maxTokens: 128,
      messages: [
        {
          role: "system",
          content:
            'Reply with a JSON object exactly like {"ok": true, "echo": "<input>"}.',
        },
        { role: "user", content: "hello" },
      ],
      schema,
    });
    expect(result.data.ok).toBe(true);
    expect(typeof result.data.echo).toBe("string");
  });
});

describe("AnthropicProvider (offline)", () => {
  it("does not throw when constructed with a dummy key", () => {
    const provider = new AnthropicProvider({ apiKey: "sk-dummy" });
    expect(provider.name).toBe("anthropic");
  });
});
