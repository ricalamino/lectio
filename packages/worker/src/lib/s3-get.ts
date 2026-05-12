import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface S3ReadConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export async function getObjectBuffer(
  cfg: S3ReadConfig,
  key: string,
): Promise<{ buffer: Buffer; contentType: string | undefined }> {
  const client = new S3Client({
    region: "us-east-1",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
    forcePathStyle: true,
  });
  const out = await client.send(
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
    }),
  );
  const body = out.Body;
  if (!body) {
    throw new Error(`S3 empty body for key ${key}`);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return { buffer: Buffer.concat(chunks), contentType: out.ContentType ?? undefined };
}
