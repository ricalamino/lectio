/**
 * Splits a WhatsApp _chat.txt style export into message-sized chunks.
 * Handles common header: [DD/MM/YY, HH:MM:SS] Name: text
 */

const MESSAGE_START =
  /^(?:\u200e|\u202a|\u202c)?\[\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\]/m;

export function parseWhatsAppChatExport(text: string, maxMessages = 3000): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let current = "";

  function flush() {
    const t = current.trim();
    if (t.length > 0) chunks.push(t);
    current = "";
  }

  for (const line of lines) {
    if (MESSAGE_START.test(line) && current.length > 0) {
      flush();
    }
    current += (current ? "\n" : "") + line;
  }
  flush();

  return chunks.filter((c) => c.length > 0 && c.length < 400_000).slice(0, maxMessages);
}
