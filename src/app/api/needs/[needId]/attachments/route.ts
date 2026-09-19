import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  generateAttachmentFileKey,
  isAllowedAttachmentMimeType,
  saveAttachmentFile,
} from "@/lib/attachment-storage";

// 상담·수요 첨부파일 — 활동 첨부와 같은 원칙. 권한은 수정·상태 전이와 같이
// assigneeAccountId 본인만, 사업화(CONVERTED)·종결(CLOSED)된 건은 잠긴다.
export async function POST(request: Request, { params }: { params: Promise<{ needId: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { needId } = await params;
  const need = await prisma.need.findUnique({ where: { id: needId } });
  if (!need) {
    return NextResponse.redirect(new URL("/needs", request.url));
  }
  if (need.assigneeAccountId !== active.account.id) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=forbidden`, request.url));
  }
  if (need.status === "CLOSED" || need.status === "CONVERTED") {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=locked`, request.url));
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=attachment_required`, request.url));
  }
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=attachment_too_large`, request.url));
  }
  if (!isAllowedAttachmentMimeType(file.type)) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=attachment_type`, request.url));
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = generateAttachmentFileKey(file.name);
  await saveAttachmentFile(fileKey, buffer);

  await prisma.attachment.create({
    data: {
      entityType: "NEED",
      entityId: need.id,
      fileKey,
      fileName: file.name.slice(0, 255),
      mimeType: file.type,
      sizeBytes: buffer.length,
      visibility: "RESTRICTED",
      uploadedByAccountId: active.account.id,
    },
  });

  return NextResponse.redirect(new URL(`/needs/${needId}`, request.url));
}
