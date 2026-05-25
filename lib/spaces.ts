import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`missing_env_${name}`);
  return v.trim();
}

export function getSpacesClient(): S3Client {
  const endpoint = requireEnv("SPACES_ENDPOINT");
  const region = (process.env.SPACES_REGION ?? "us-east-1").trim();
  const accessKeyId = requireEnv("SPACES_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("SPACES_SECRET_ACCESS_KEY");
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });
}

export function getReportBucket(): string {
  return requireEnv("SPACES_REPORTS_BUCKET");
}

export function getReportsPrefix(): string {
  const p = (process.env.SPACES_REPORTS_PREFIX ?? "reports/").trim() || "reports/";
  return p.endsWith("/") ? p : `${p}/`;
}

export function getSpacesPublicBaseUrl(): string {
  // Example: https://<bucket>.nyc3.digitaloceanspaces.com
  return requireEnv("SPACES_PUBLIC_BASE_URL").replace(/\/+$/, "");
}

export async function uploadPdfToSpaces(input: { bytes: Buffer; filenameBase: string }): Promise<{ bucket: string; key: string; publicUrl: string }> {
  const client = getSpacesClient();
  const bucket = getReportBucket();
  const prefix = getReportsPrefix();
  const nonce = crypto.randomUUID();
  const key = `${prefix}${input.filenameBase}-${nonce}.pdf`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.bytes,
      ContentType: "application/pdf",
      ACL: "public-read"
    })
  );

  const publicUrl = `${getSpacesPublicBaseUrl()}/${key}`;
  return { bucket, key, publicUrl };
}

