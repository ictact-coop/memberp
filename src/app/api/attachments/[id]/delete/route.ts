import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// 잘못 올린 첨부파일을 지운다. 실제 파일은 디스크에 남기고(ADR-0004) DB에서만
// 소프트 삭제한다 — 업로더 본인이, 기여가 아직 DRAFT/NEEDS_REVISION일 때만 가능하다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { contribution: true },
  });
  if (!attachment || !attachment.contribution) {
    return NextResponse.redirect(new URL("/my/contributions", request.url));
  }
  if (attachment.uploadedByAccountId !== active.account.id) {
    return NextResponse.redirect(new URL("/my/contributions?error=forbidden", request.url));
  }
  const contributionId = attachment.contribution.id;
  if (
    attachment.contribution.status !== "DRAFT" &&
    attachment.contribution.status !== "NEEDS_REVISION"
  ) {
    return NextResponse.redirect(
      new URL(`/my/contributions/new?id=${contributionId}&error=locked`, request.url),
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
    const remaining = await tx.attachment.count({
      where: { contributionId, deletedAt: null },
    });
    if (remaining === 0) {
      // 남은 증빙이 없으면 자동 승격했던 DOCUMENTED를 되돌린다.
      await tx.contribution.updateMany({
        where: { id: contributionId, evidenceLevel: "DOCUMENTED" },
        data: { evidenceLevel: "SELF_REPORTED" },
      });
    }
  });

  return NextResponse.redirect(new URL(`/my/contributions/new?id=${contributionId}`, request.url));
}
