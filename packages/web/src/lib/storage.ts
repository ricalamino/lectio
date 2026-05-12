import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageEnv {
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
}

export function isObjectStorageConfigured(env: StorageEnv): boolean {
  return Boolean(
    env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY,
  );
}

function client(env: StorageEnv): S3Client {
  return new S3Client({
    region: "us-east-1",
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY!,
      secretAccessKey: env.S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
}

async function ensureBucket(env: StorageEnv): Promise<void> {
  const c = client(env);
  const bucket = env.S3_BUCKET!;
  try {
    await c.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await c.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (err: unknown) {
      const name = err && typeof err === "object" && "name" in err ? (err as { name?: string }).name : "";
      if (name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists") return;
      throw err;
    }
  }
}

export async function putCaptureObject(
  env: StorageEnv,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (!isObjectStorageConfigured(env)) {
    throw new Error("Object storage is not configured");
  }
  await ensureBucket(env);
  const c = client(env);
  await c.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getCaptureObjectSignedUrl(
  env: StorageEnv,
  key: string,
  expiresSeconds = 3600,
): Promise<string> {
  if (!isObjectStorageConfigured(env)) {
    throw new Error("Object storage is not configured");
  }
  await ensureBucket(env);
  const c = client(env);
  const cmd = new GetObjectCommand({ Bucket: env.S3_BUCKET!, Key: key });
  return getSignedUrl(c, cmd, { expiresIn: expiresSeconds });
}

export function safeUploadFileName(name: string): string {
  const trimmed = name.trim() || "upload";
  const base = trimmed.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "");
  return base.slice(0, 180) || "upload";
}
