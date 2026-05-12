import { describe, expect, it } from "vitest";
import { parseWhatsAppChatExport } from "./whatsapp.js";

describe("parseWhatsAppChatExport", () => {
  it("splits on dated lines", () => {
    const text = `[01/02/24, 10:00:15] Alice: first line
continued
[01/02/24, 10:01:00] Bob: second message`;
    const parts = parseWhatsAppChatExport(text);
    expect(parts.length).toBe(2);
    expect(parts[0]).toContain("Alice");
    expect(parts[1]).toContain("Bob");
  });
});
