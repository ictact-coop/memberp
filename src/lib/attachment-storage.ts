import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// ADR-0004: R1은 로컬 디스크에 저장했다. "조합이 S3/MinIO 등을 정하면 이 파일만
// 바꿔 이전한다"는 약속을 실제로 지킨 게 이 파일이다 — 저장 방식을
// ATTACHMENT_STORAGE_DRIVER 환경변수로 고르게 하고, 호출하는 쪽(첨부 업로드·
// 다운로드 API 네 곳)은 이 파일이 내보내는 함수 이름·시그니처가 그대로라
// 한 줄도 바꿀 필요가 없다. DB의 fileKey도 드라이버와 무관하게 그대로 쓴다.
// 기본값은 지금까지와 똑같은 "local"이라, 아무 설정도 하지 않은 배포는 동작이
// 전혀 바뀌지 않는다.
type AttachmentStorageDriver = "local" | "s3";

function getStorageDriver(): AttachmentStorageDriver {
  return process.env.ATTACHMENT_STORAGE_DRIVER === "s3" ? "s3" : "local";
}

const LOCAL_STORAGE_DIR = process.env.ATTACHMENT_STORAGE_DIR
  ? path.resolve(process.env.ATTACHMENT_STORAGE_DIR)
  : path.join(process.cwd(), "storage", "attachments");

export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return (ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

// 원본 파일명은 그대로 신뢰하지 않는다 — 확장자만 뽑아 무작위 키에 붙인다.
// 드라이버와 무관하게 같은 키 형식을 쓴다(로컬 파일명이자 S3 객체 키).
export function generateAttachmentFileKey(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${randomUUID()}${ext}`;
}

async function saveAttachmentFileLocal(fileKey: string, data: Buffer): Promise<void> {
  await mkdir(LOCAL_STORAGE_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_STORAGE_DIR, path.basename(fileKey)), data);
}

async function readAttachmentFileLocal(fileKey: string): Promise<Buffer> {
  return readFile(path.join(LOCAL_STORAGE_DIR, path.basename(fileKey)));
}

// AWS SDK는 MinIO 등 S3 호환 서비스에도 그대로 쓸 수 있다 — ATTACHMENT_S3_ENDPOINT를
// 채우고 forcePathStyle을 켜면 된다(MinIO는 버추얼호스트 스타일 URL을 지원하지
// 않는 경우가 많다). 매 호출마다 새로 만든다 — 요청량이 크지 않은 조합 규모에서
// 커넥션 풀을 계속 유지할 이유가 없다(ADR-0001).
function getS3Client(): S3Client {
  const endpoint = process.env.ATTACHMENT_S3_ENDPOINT || undefined;
  return new S3Client({
    region: process.env.ATTACHMENT_S3_REGION || "us-east-1",
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: process.env.ATTACHMENT_S3_FORCE_PATH_STYLE === "true",
  });
}

function getS3Bucket(): string {
  const bucket = process.env.ATTACHMENT_S3_BUCKET;
  if (!bucket) {
    throw new Error("ATTACHMENT_S3_BUCKET 환경변수가 설정되지 않았습니다.");
  }
  return bucket;
}

async function saveAttachmentFileS3(fileKey: string, data: Buffer): Promise<void> {
  const client = getS3Client();
  await client.send(new PutObjectCommand({ Bucket: getS3Bucket(), Key: fileKey, Body: data }));
}

async function readAttachmentFileS3(fileKey: string): Promise<Buffer> {
  const client = getS3Client();
  const result = await client.send(new GetObjectCommand({ Bucket: getS3Bucket(), Key: fileKey }));
  if (!result.Body) {
    throw new Error(`S3 객체를 찾을 수 없습니다: ${fileKey}`);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of result.Body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function saveAttachmentFile(fileKey: string, data: Buffer): Promise<void> {
  return getStorageDriver() === "s3"
    ? saveAttachmentFileS3(fileKey, data)
    : saveAttachmentFileLocal(fileKey, data);
}

export async function readAttachmentFile(fileKey: string): Promise<Buffer> {
  return getStorageDriver() === "s3" ? readAttachmentFileS3(fileKey) : readAttachmentFileLocal(fileKey);
}
