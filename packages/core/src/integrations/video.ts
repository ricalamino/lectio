/**
 * Extract the audio track of a video to mono 16 kHz mp3 for Whisper.
 *
 * Requires `ffmpeg` on PATH. The worker Docker image ships it; on dev
 * machines install via `apt-get install ffmpeg` or `brew install ffmpeg`.
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface FfmpegRunResult {
  /** Output mp3 buffer. */
  audio: Buffer;
  /** Duration in seconds, if ffmpeg reported it. */
  durationSec: number | null;
}

export async function extractAudioFromVideo(input: {
  buffer: Buffer;
  /** Filename hint for ffmpeg input format autodetect (e.g. "clip.mp4"). */
  filename: string;
}): Promise<FfmpegRunResult> {
  const dir = await mkdtemp(join(tmpdir(), "lectio-vid-"));
  const inputPath = join(dir, input.filename || "input.bin");
  const outputPath = join(dir, "audio.mp3");
  try {
    await writeFile(inputPath, input.buffer);
    const { stderr } = await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      "-f",
      "mp3",
      outputPath,
    ]);
    const audio = await readFile(outputPath);
    return { audio, durationSec: parseDuration(stderr) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function parseDuration(stderr: string): number | null {
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function runFfmpeg(args: string[]): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      reject(new Error(`ffmpeg spawn failed: ${err.message}. Install ffmpeg in the worker image.`));
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stderr });
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}
