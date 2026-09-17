import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// FR-07 확인. "담당 범위"는 활동 책임자(Activity.managerAccountId) 또는 수요 담당자
// (Need.assigneeAccountId)로 판단한다 — 역할(PermissionGrant)이 아니라 실제 소유권으로
// 검사한다. /review 페이지는 역할 또는 소유권 중 하나만 있어도 들어올 수 있지만
// (roles.ts의 canAccessReviewInbox), 실제로 "이 항목을 확인해도 되는가"는 소유권만
// 본다 — 역할이 있어도 남의 활동 제출물을 확인할 수는 없다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const contribution = await prisma.contribution.findUnique({
    where: { id },
    include: { activity: true, need: true },
  });
  if (!contribution) {
    return NextResponse.redirect(new URL("/review", request.url));
  }

  const isManager =
    contribution.activity?.managerAccountId === active.account.id ||
    contribution.need?.assigneeAccountId === active.account.id;
  if (!isManager) {
    return NextResponse.redirect(new URL("/review?error=forbidden", request.url));
  }
  // v1.0 §3: 본인의 기여를 스스로 최종 확인하는 것은 기본적으로 제한한다.
  // 소규모 조직의 예외 규칙은 아직 정책이 정해지지 않아(ADR-0001) 구현하지 않았다.
  if (contribution.authorAccountId === active.account.id) {
    return NextResponse.redirect(new URL("/review?error=self_confirm", request.url));
  }
  if (contribution.status !== "SUBMITTED") {
    return NextResponse.redirect(new URL("/review", request.url));
  }

  await prisma.$transaction(async (tx) => {
    await tx.contribution.update({
      where: { id: contribution.id },
      data: { status: "CONFIRMED", confirmedByAccountId: active.account.id, confirmedAt: new Date() },
    });
    // BR-04/05: 새 버전이 확인되면 원본을 대체됨으로 표시해 중복 집계를 막는다.
    if (contribution.revisionOfId) {
      await tx.contribution.update({
        where: { id: contribution.revisionOfId },
        data: { status: "SUPERSEDED", supersededByContributionId: contribution.id },
      });
    }
  });

  return NextResponse.redirect(new URL("/review", request.url));
}
