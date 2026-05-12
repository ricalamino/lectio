import OpenAI, { toFile } from "openai";

export async function transcribeAudioOpenAI(params: {
  apiKey: string;
  model: string;
  buffer: Buffer;
  filename: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey });
  const file = await toFile(params.buffer, params.filename);
  const result = await client.audio.transcriptions.create({
    file,
    model: params.model,
  });
  return result.text;
}

export async function ocrImageOpenAI(params: {
  apiKey: string;
  model: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey });
  const b64 = params.buffer.toString("base64");
  const url = `data:${params.mimeType};base64,${b64}`;
  const result = await client.chat.completions.create({
    model: params.model,
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all readable text from this image. Preserve line breaks where meaningful. If there is no text, briefly describe what you see in one or two sentences.",
          },
          { type: "image_url", image_url: { url } },
        ],
      },
    ],
  });
  const text = result.choices[0]?.message?.content;
  return typeof text === "string" ? text.trim() : "";
}
