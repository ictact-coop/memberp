import { NextResponse } from "next/server";
import { ActivityManagementType, Mission, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { getSelfAndDescendantActivityIds } from "@/lib/activity-hierarchy";
import { nextDisplayId } from "@/lib/display-id";

// FR-04 활동 정정 이력 — v0.1 §3.2 "종료 후 수정은 정정 이력으로". 종료·취소된
// 활동은 직접 고칠 수 없다(activities/[id]/update가 잠근다). 대신 이 라우트가
// 원본을 가리키는 새 활동 행을 만들고, 원본이 갖고 있던 참조(하위 활동·참여
// 배정·기여·연결된 필요·첨부파일·권한 범위)를 전부 새 행으로 옮긴 뒤 원본에
// supersededByActivityId를 채운다 — 기여의 revisionOfId/
// supersededByContributionId와 같은 패턴이지만, 별도 확인 절차 없이 만드는
// 즉시 새 행이 현재 기록이 된다(책임자 본인이 정정하는 것이라 남이 확인해줄
// 대상이 없다).
export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { activityId } = await params;
  const original = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!original) {
    return NextResponse.redirect(new URL("/activities", request.url));
  }
  if (original.managerAccountId !== active.account.id) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=forbidden`, request.url));
  }
  if (original.status !== "CLOSED" && original.status !== "CANCELLED") {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=not_locked`, request.url));
  }
  if (original.supersededByActivityId) {
    return NextResponse.redirect(
      new URL(`/activities/${original.supersededByActivityId}?error=already_revised`, request.url),
    );
  }

  const formData = await request.formData();
  const title = formData.get("title");
  const purpose = formData.get("purpose");
  const managementTypeRaw = formData.get("managementType");
  const managerAccountId = formData.get("managerAccountId");
  const visibilityRaw = formData.get("visibility");
  const missionValues = formData.getAll("missions");
  const plannedStartDateRaw = formData.get("plannedStartDate");
  const plannedEndDateRaw = formData.get("plannedEndDate");
  const parentActivityIdRaw = formData.get("parentActivityId");
  const budgetBaselineRaw = formData.get("budgetBaseline");

  const isValidManagementType =
    typeof managementTypeRaw === "string" &&
    (Object.values(ActivityManagementType) as string[]).includes(managementTypeRaw);
  const missions = missionValues.filter(
    (value): value is string =>
      typeof value === "string" && (Object.values(Mission) as string[]).includes(value),
  ) as Mission[];

  if (
    typeof title !== "string" ||
    !title.trim() ||
    typeof purpose !== "string" ||
    !purpose.trim() ||
    !isValidManagementType ||
    typeof managerAccountId !== "string" ||
    !managerAccountId ||
    missions.length === 0
  ) {
    return NextResponse.redirect(new URL(`/activities/${activityId}/revise?error=invalid`, request.url));
  }

  const manager = await prisma.account.findUnique({ where: { id: managerAccountId } });
  if (!manager) {
    return NextResponse.redirect(
      new URL(`/activities/${activityId}/revise?error=invalid_manager`, request.url),
    );
  }

  const visibility: Visibility =
    typeof visibilityRaw === "string" && (Object.values(Visibility) as string[]).includes(visibilityRaw)
      ? (visibilityRaw as Visibility)
      : "TEAM";

  const plannedStartDate =
    typeof plannedStartDateRaw === "string" && plannedStartDateRaw ? new Date(plannedStartDateRaw) : null;
  const plannedEndDate =
    typeof plannedEndDateRaw === "string" && plannedEndDateRaw ? new Date(plannedEndDateRaw) : null;
  if (plannedStartDate && plannedEndDate && plannedEndDate < plannedStartDate) {
    return NextResponse.redirect(
      new URL(`/activities/${activityId}/revise?error=invalid_dates`, request.url),
    );
  }

  // 새 행은 원본이 트리에서 있던 자리를 그대로 물려받는다(아래에서 원본의 하위
  // 활동을 새 행으로 옮긴다) — 그래서 순환 방지도 원본 기준으로 계산한다:
  // 원본 자신이나 원본의 하위 활동을 상위로 고르면 안 된다.
  const parentActivityId =
    typeof parentActivityIdRaw === "string" && parentActivityIdRaw ? parentActivityIdRaw : null;
  if (parentActivityId) {
    const parent = await prisma.activity.findUnique({ where: { id: parentActivityId } });
    if (!parent) {
      return NextResponse.redirect(
        new URL(`/activities/${activityId}/revise?error=invalid_parent`, request.url),
      );
    }
    const forbiddenParentIds = await getSelfAndDescendantActivityIds(prisma, activityId);
    if (forbiddenParentIds.has(parentActivityId)) {
      return NextResponse.redirect(
        new URL(`/activities/${activityId}/revise?error=invalid_parent_cycle`, request.url),
      );
    }
  }

  const budgetBaseline =
    typeof budgetBaselineRaw === "string" && budgetBaselineRaw ? budgetBaselineRaw : null;
  if (budgetBaseline && (Number.isNaN(Number(budgetBaseline)) || Number(budgetBaseline) < 0)) {
    return NextResponse.redirect(
      new URL(`/activities/${activityId}/revise?error=invalid_budget`, request.url),
    );
  }

  const revision = await prisma.$transaction(async (tx) => {
    const displayId = await nextDisplayId(tx, "ACT");
    const created = await tx.activity.create({
      data: {
        displayId,
        title: title.trim(),
        purpose: purpose.trim(),
        managementType: managementTypeRaw as ActivityManagementType,
        missions,
        managerAccountId,
        visibility,
        plannedStartDate,
        plannedEndDate,
        parentActivityId,
        budgetBaseline,
        status: original.status,
        actualStartDate: original.actualStartDate,
        actualEndDate: original.actualEndDate,
        closeEvaluationNote: original.closeEvaluationNote,
        closedAt: original.closedAt,
        organizerSubjectId: original.organizerSubjectId,
        revisionOfId: original.id,
        createdBy: active.account.id,
      },
    });

    // 원본을 가리키던 참조를 전부 새 행으로 옮긴다 — 정정본이 "현재 기록"이 되므로,
    // 하위 활동·참여 배정·기여·연결된 필요·분류·첨부파일·권한 범위 모두 새 행을
    // 따라가야 한다. 감사기록(AuditLog)만은 옮기지 않는다 — 그 변경이 실제로
    // 일어난 시점의 기록이라는 역사적 정확성을 유지한다.
    await tx.activity.updateMany({
      where: { parentActivityId: original.id },
      data: { parentActivityId: created.id },
    });
    await tx.activityAssignment.updateMany({
      where: { activityId: original.id },
      data: { activityId: created.id },
    });
    await tx.contribution.updateMany({
      where: { activityId: original.id },
      data: { activityId: created.id },
    });
    await tx.needActivityLink.updateMany({
      where: { activityId: original.id },
      data: { activityId: created.id },
    });
    await tx.activityClassification.updateMany({
      where: { activityId: original.id },
      data: { activityId: created.id },
    });
    await tx.attachment.updateMany({
      where: { entityType: "ACTIVITY", entityId: original.id },
      data: { entityId: created.id },
    });
    await tx.permissionGrant.updateMany({
      where: { scopeType: "ACTIVITY", scopeId: original.id },
      data: { scopeId: created.id },
    });

    await tx.activity.update({
      where: { id: original.id },
      data: { supersededByActivityId: created.id, updatedBy: active.account.id },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Activity",
        entityId: original.id,
        action: "UPDATE",
        actorAccountId: active.account.id,
        reason: `정정 이력: ${displayId}로 대체됨`,
        beforeData: { supersededByActivityId: null },
        afterData: { supersededByActivityId: created.id },
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Activity",
        entityId: created.id,
        action: "CREATE",
        actorAccountId: active.account.id,
        reason: `정정 이력: ${original.displayId}를 대체하며 생성됨`,
        afterData: {
          title: title.trim(),
          purpose: purpose.trim(),
          managementType: managementTypeRaw,
          missions,
          managerAccountId,
          visibility,
          plannedStartDate,
          plannedEndDate,
          parentActivityId,
          budgetBaseline,
        },
      },
    });

    return created;
  });

  return NextResponse.redirect(new URL(`/activities/${revision.id}`, request.url));
}
