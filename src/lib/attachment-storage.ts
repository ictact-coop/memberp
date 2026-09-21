import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// ADR-0004: R1은 로컬 디스크에 저장한다. 저장 위치를 이 파일 하나로 감싸 두면,
// 나중에 S3/MinIO로 옮길 때 여기 두 함수만 바꾸면 된다(DB의 fileKey는 그대로 쓸 수 있다).
const STORAGE_DIR = process.env.ATTACHMENT_STORAGE_DIR
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
export function generateAttachmentFileKey(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${randomUUID()}${ext}`;
}

export async function saveAttachmentFile(fileKey: string, data: Buffer): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(path.join(STORAGE_DIR, path.basename(fileKey)), data);
}

export async function readAttachmentFile(fileKey: string): Promise<Buffer> {
  return readFile(path.join(STORAGE_DIR, path.basename(fileKey)));
}
