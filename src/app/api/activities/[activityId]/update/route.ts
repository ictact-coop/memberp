import { NextResponse } from "next/server";
import { ActivityManagementType, Mission, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { getSelfAndDescendantActivityIds } from "@/lib/activity-hierarchy";

// FR-04 활동 수정. 등록(create)과 같은 필수 필드 검증을 쓴다. 권한과 잠금 규칙은
// 상태 전이와 같은 원칙: 그 활동의 managerAccountId만, 그리고 종료·취소된 활동은
// "수정은 정정 이력"(v0.1 §3.2)이라 이 API에서 막는다(정정 절차는 아직 없음).
export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { activityId } = await params;
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
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
    return NextResponse.redirect(new URL(`/activities/${activityId}/edit?error=invalid`, request.url));
  }

  const manager = await prisma.account.findUnique({ where: { id: managerAccountId } });
  if (!manager) {
    return NextResponse.redirect(
      new URL(`/activities/${activityId}/edit?error=invalid_manager`, request.url),
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
      new URL(`/activities/${activityId}/edit?error=invalid_dates`, request.url),
    );
  }

  const parentActivityId =
    typeof parentActivityIdRaw === "string" && parentActivityIdRaw ? parentActivityIdRaw : null;
  if (parentActivityId) {
    const parent = await prisma.activity.findUnique({ where: { id: parentActivityId } });
    if (!parent) {
      return NextResponse.redirect(
        new URL(`/activities/${activityId}/edit?error=invalid_parent`, request.url),
      );
    }
    // 자기 자신 또는 자신의 하위 활동을 상위 활동으로 지정하면 순환(A→B→A)이 생긴다.
    const forbiddenParentIds = await getSelfAndDescendantActivityIds(prisma, activityId);
    if (forbiddenParentIds.has(parentActivityId)) {
      return NextResponse.redirect(
        new URL(`/activities/${activityId}/edit?error=invalid_parent_cycle`, request.url),
      );
    }
  }

  const budgetBaseline =
    typeof budgetBaselineRaw === "string" && budgetBaselineRaw ? budgetBaselineRaw : null;
  if (budgetBaseline && (Number.isNaN(Number(budgetBaseline)) || Number(budgetBaseline) < 0)) {
    return NextResponse.redirect(
      new URL(`/activities/${activityId}/edit?error=invalid_budget`, request.url),
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.activity.update({
      where: { id: activityId },
      data: {
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
        updatedBy: active.account.id,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Activity",
        entityId: activityId,
        action: "UPDATE",
        actorAccountId: active.account.id,
        beforeData: {
          title: activity.title,
          purpose: activity.purpose,
          managementType: activity.managementType,
          missions: activity.missions,
          managerAccountId: activity.managerAccountId,
          visibility: activity.visibility,
          plannedStartDate: activity.plannedStartDate,
          plannedEndDate: activity.plannedEndDate,
          parentActivityId: activity.parentActivityId,
          budgetBaseline: activity.budgetBaseline,
        },
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
  });

  return NextResponse.redirect(new URL(`/activities/${activityId}`, request.url));
}
