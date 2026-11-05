import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// 활동 서비스 분류 태깅 — ActivityClassification은 R1 스키마 설계 때부터
// 있었지만 태그를 붙이는 화면이 없었다. 활동 정보 수정과 같은 권한·잠금
// 규칙을 그대로 쓴다: 그 활동의 책임자만, 종료·취소된 활동은 수정 불가
// (정정 이력 몫).
//
// 체크박스 여러 개를 한 번에 제출받아 "지금 선택된 집합"으로 통째로
// 맞춘다(하나씩 추가·삭제하는 API 여러 개보다 태그 편집 UI에 자연스럽다) —
// 선택 해제된 태그는 지우고, 새로 선택된 태그만 추가한다.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { activityId } = await params;
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { classifications: { include: { classification: true } } },
  });
  if (!activity) {
    return NextResponse.redirect(new URL("/activities", request.url));
  }
  if (activity.managerAccountId !== active.account.id) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=forbidden`, request.url));
  }
  if (activity.status === "CLOSED" || activity.status === "CANCELLED") {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=locked`, request.url));
  }

  const formData = await request.formData();
  const submittedIds = new Set(formData.getAll("classificationIds").filter((v): v is string => typeof v === "string"));

  // 제출된 값 중 실제로 존재하고 활성 상태인 ACTIVITY_SERVICE 분류만 인정한다 —
  // 다른 domain의 ID나 사용 중지된 분류를 새로 붙이는 요청은 조용히 무시한다.
  const validChoices = await prisma.classification.findMany({
    where: { id: { in: Array.from(submittedIds) }, domain: "ACTIVITY_SERVICE", active: true },
    select: { id: true, label: true },
  });
  const validChoiceIds = new Set(validChoices.map((c) => c.id));

  const currentLinks = activity.classifications.filter(
    (link) => link.classification.domain === "ACTIVITY_SERVICE",
  );
  const currentIds = new Set(currentLinks.map((link) => link.classificationId));

  const toAdd = Array.from(validChoiceIds).filter((id) => !currentIds.has(id));
  const toRemoveLinkIds = currentLinks
    .filter((link) => !validChoiceIds.has(link.classificationId))
    .map((link) => link.id);

  if (toAdd.length === 0 && toRemoveLinkIds.length === 0) {
    return NextResponse.redirect(new URL(`/activities/${activityId}`, request.url));
  }

  await prisma.$transaction(async (tx) => {
    if (toRemoveLinkIds.length > 0) {
      await tx.activityClassification.deleteMany({ where: { id: { in: toRemoveLinkIds } } });
    }
    if (toAdd.length > 0) {
      await tx.activityClassification.createMany({
        data: toAdd.map((classificationId) => ({ activityId, classificationId })),
      });
    }
    await tx.auditLog.create({
      data: {
        entityType: "Activity",
        entityId: activityId,
        action: "UPDATE",
        actorAccountId: active.account.id,
        beforeData: { serviceClassifications: currentLinks.map((link) => link.classification.label) },
        afterData: {
          serviceClassifications: [
            ...currentLinks
              .filter((link) => validChoiceIds.has(link.classificationId))
              .map((link) => link.classification.label),
            ...validChoices.filter((c) => toAdd.includes(c.id)).map((c) => c.label),
          ],
        },
        reason: "활동 서비스 분류 태그 수정",
      },
    });
  });

  return NextResponse.redirect(new URL(`/activities/${activityId}`, request.url));
}
