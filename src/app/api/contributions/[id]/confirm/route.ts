import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// FR-07 확인. "담당 범위"는 활동 책임자(Activity.managerAccountId) 또는 수요 담당자
// (Need.assigneeAccountId)로 판단한다 — 아직 별도 권한 시스템이 없어 이미 있는
// 소유권 필드를 재사용했다.
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
