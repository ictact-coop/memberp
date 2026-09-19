import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// 잘못 올린 첨부파일을 지운다. 실제 파일은 디스크에 남기고(ADR-0004) DB에서만
// 소프트 삭제한다 — 업로더 본인만, 그리고 그 대상(기여/활동/상담)이 잠기지 않은
// 상태일 때만 가능하다. entityType별로 "누가 잠그는가"·"어디로 돌아가는가"가
// 다르므로 각각 조회해 확인한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (attachment.uploadedByAccountId !== active.account.id) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  if (attachment.entityType === "CONTRIBUTION") {
    const contribution = await prisma.contribution.findUnique({ where: { id: attachment.entityId } });
    if (!contribution) {
      return NextResponse.redirect(new URL("/my/contributions", request.url));
    }
    if (contribution.status !== "DRAFT" && contribution.status !== "NEEDS_REVISION") {
      return NextResponse.redirect(
        new URL(`/my/contributions/new?id=${contribution.id}&error=locked`, request.url),
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
      const remaining = await tx.attachment.count({
        where: { contributionId: contribution.id, deletedAt: null },
      });
      if (remaining === 0) {
        // 남은 증빙이 없으면 자동 승격했던 DOCUMENTED를 되돌린다.
        await tx.contribution.updateMany({
          where: { id: contribution.id, evidenceLevel: "DOCUMENTED" },
          data: { evidenceLevel: "SELF_REPORTED" },
        });
      }
    });
    return NextResponse.redirect(
      new URL(`/my/contributions/new?id=${contribution.id}`, request.url),
    );
  }

  if (attachment.entityType === "ACTIVITY") {
    const activity = await prisma.activity.findUnique({ where: { id: attachment.entityId } });
    if (!activity) {
      return NextResponse.redirect(new URL("/activities", request.url));
    }
    if (activity.status === "CLOSED" || activity.status === "CANCELLED") {
      return NextResponse.redirect(
        new URL(`/activities/${activity.id}?error=locked`, request.url),
      );
    }
    await prisma.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.redirect(new URL(`/activities/${activity.id}`, request.url));
  }

  // NEED
  const need = await prisma.need.findUnique({ where: { id: attachment.entityId } });
  if (!need) {
    return NextResponse.redirect(new URL("/needs", request.url));
  }
  if (need.status === "CLOSED" || need.status === "CONVERTED") {
    return NextResponse.redirect(new URL(`/needs/${need.id}?error=locked`, request.url));
  }
  await prisma.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.redirect(new URL(`/needs/${need.id}`, request.url));
}
