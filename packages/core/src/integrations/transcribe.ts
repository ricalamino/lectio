/**
 * Transcription adapter.
 *
 * Two backends share the OpenAI audio transcription wire format:
 *   - "openai":            api.openai.com (real Whisper hosted by OpenAI)
 *   - "openai_compatible": any local server implementing the same endpoint
 *                          (faster-whisper-server, LocalAI, Speaches, ...)
 *
 * Both accept multipart with `file` + `model` and return `{ text: "..." }`,
 * so a single helper covers them by varying base URL and auth.
 */

import OpenAI, { toFile } from "openai";

export type TranscribeBackend = "openai" | "openai_compatible";

export interface TranscribeConfig {
  backend: TranscribeBackend;
  /** Required for `openai`. Optional for `openai_compatible` (some servers ignore it). */
  apiKey?: string;
  /** Required for `openai_compatible`. e.g. http://whisper:9000/v1 */
  baseUrl?: string;
  model: string;
}

export async function transcribeAudio(params: {
  config: TranscribeConfig;
  buffer: Buffer;
  filename: string;
}): Promise<string> {
  const { config, buffer, filename } = params;
  const file = await toFile(buffer, filename);

  if (config.backend === "openai") {
    if (!config.apiKey) throw new Error("transcribe: OpenAI backend requires apiKey");
    const client = new OpenAI({ apiKey: config.apiKey });
    const result = await client.audio.transcriptions.create({ file, model: config.model });
    return result.text;
  }

  if (!config.baseUrl) {
    throw new Error("transcribe: openai_compatible backend requires baseUrl");
  }
  // The openai SDK can target any compatible endpoint via baseURL. A dummy
  // apiKey keeps the SDK happy when the local server does not check it.
  const client = new OpenAI({
    apiKey: config.apiKey ?? "not-used",
    baseURL: config.baseUrl.replace(/\/$/, ""),
  });
  const result = await client.audio.transcriptions.create({ file, model: config.model });
  return result.text;
}
