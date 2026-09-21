import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  generateAttachmentFileKey,
  isAllowedAttachmentMimeType,
  saveAttachmentFile,
} from "@/lib/attachment-storage";

// 기여 증빙 첨부 — v0.1 A06. 아직 임시저장·이어 작성 중인(DRAFT/NEEDS_REVISION)
// 기여에만, 작성자 본인만 첨부할 수 있다. 저장 방식은 ADR-0004(로컬 디스크, 인증
// 라우트로만 다운로드) 참고.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!active.account.subjectId) {
    return NextResponse.redirect(new URL("/my/contributions/new?error=no_subject", request.url));
  }

  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({ where: { id } });
  if (!contribution) {
    return NextResponse.redirect(new URL("/my/contributions", request.url));
  }
  if (contribution.contributorSubjectId !== active.account.subjectId) {
    return NextResponse.redirect(new URL("/my/contributions?error=forbidden", request.url));
  }
  if (contribution.status !== "DRAFT" && contribution.status !== "NEEDS_REVISION") {
    return NextResponse.redirect(
      new URL(`/my/contributions/new?id=${id}&error=locked`, request.url),
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(
      new URL(`/my/contributions/new?id=${id}&error=attachment_required`, request.url),
    );
  }
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return NextResponse.redirect(
      new URL(`/my/contributions/new?id=${id}&error=attachment_too_large`, request.url),
    );
  }
  if (!isAllowedAttachmentMimeType(file.type)) {
    return NextResponse.redirect(
      new URL(`/my/contributions/new?id=${id}&error=attachment_type`, request.url),
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = generateAttachmentFileKey(file.name);
  await saveAttachmentFile(fileKey, buffer);

  await prisma.$transaction([
    prisma.attachment.create({
      data: {
        entityType: "CONTRIBUTION",
        entityId: contribution.id,
        contributionId: contribution.id,
        fileKey,
        fileName: file.name.slice(0, 255),
        mimeType: file.type,
        sizeBytes: buffer.length,
        visibility: "RESTRICTED",
        uploadedByAccountId: active.account.id,
      },
    }),
    // 증거 없는 자가신고(SELF_REPORTED)만 자동으로 올려준다 — 참여자 확인(PARTICIPANT_
    // CONFIRMED)처럼 이미 더 높은 등급이 정해져 있으면 건드리지 않는다.
    prisma.contribution.updateMany({
      where: { id: contribution.id, evidenceLevel: "SELF_REPORTED" },
      data: { evidenceLevel: "DOCUMENTED" },
    }),
  ]);

  return NextResponse.redirect(new URL(`/my/contributions/new?id=${id}`, request.url));
}
