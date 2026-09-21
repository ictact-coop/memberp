import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { readAttachmentFile } from "@/lib/attachment-storage";

// 첨부파일 다운로드 — public/ 대신 이 인증 라우트로만 제공한다(ADR-0004). 업로더
// 본인이거나, 그 대상을 담당하는 사람(기여가 딸린 활동 책임자·상담 담당자, 또는
// 활동 자체의 책임자·상담 자체의 담당자)만 내려받을 수 있다.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      contribution: { include: { activity: true, need: true } },
    },
  });
  if (!attachment || attachment.deletedAt) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const isUploader = attachment.uploadedByAccountId === active.account.id;
  let isReviewer = false;
  if (attachment.entityType === "CONTRIBUTION") {
    isReviewer =
      attachment.contribution?.activity?.managerAccountId === active.account.id ||
      attachment.contribution?.need?.assigneeAccountId === active.account.id;
  } else if (attachment.entityType === "ACTIVITY") {
    const activity = await prisma.activity.findUnique({ where: { id: attachment.entityId } });
    isReviewer = activity?.managerAccountId === active.account.id;
  } else {
    const need = await prisma.need.findUnique({ where: { id: attachment.entityId } });
    isReviewer = need?.assigneeAccountId === active.account.id;
  }
  if (!isUploader && !isReviewer) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const buffer = await readAttachmentFile(attachment.fileKey);
  const safeName = attachment.fileName.replace(/[\r\n"]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(attachment.sizeBytes),
    },
  });
}
