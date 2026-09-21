import { NextResponse } from "next/server";
import { ActivityManagementType, Mission, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { ACTIVITY_OPERATIONS_ROLES, hasAnyRole } from "@/lib/auth/roles";
import { nextDisplayId } from "@/lib/display-id";

// FR-04 활동 등록. v0.1 A01: 관리유형·미션(1개 이상)·목적·책임자는 필수.
// 새 활동은 항상 "기획" 상태로 시작한다(BR: 승인 절차를 건너뛰고 곧바로
// 진행/완료 상태로 만들 수 없다) — 그래서 상태는 폼 입력을 받지 않는다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, ACTIVITY_OPERATIONS_ROLES))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
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
    return NextResponse.redirect(new URL("/activities/new?error=invalid", request.url));
  }

  const manager = await prisma.account.findUnique({ where: { id: managerAccountId } });
  if (!manager) {
    return NextResponse.redirect(new URL("/activities/new?error=invalid_manager", request.url));
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
    return NextResponse.redirect(new URL("/activities/new?error=invalid_dates", request.url));
  }

  const parentActivityId =
    typeof parentActivityIdRaw === "string" && parentActivityIdRaw ? parentActivityIdRaw : null;
  if (parentActivityId) {
    const parent = await prisma.activity.findUnique({ where: { id: parentActivityId } });
    if (!parent) {
      return NextResponse.redirect(new URL("/activities/new?error=invalid_parent", request.url));
    }
  }

  const budgetBaseline =
    typeof budgetBaselineRaw === "string" && budgetBaselineRaw ? budgetBaselineRaw : null;
  if (budgetBaseline && (Number.isNaN(Number(budgetBaseline)) || Number(budgetBaseline) < 0)) {
    return NextResponse.redirect(new URL("/activities/new?error=invalid_budget", request.url));
  }

  const activity = await prisma.$transaction(async (tx) => {
    const displayId = await nextDisplayId(tx, "ACT");
    return tx.activity.create({
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
        status: "PLANNING",
        createdBy: active.account.id,
      },
    });
  });

  return NextResponse.redirect(new URL(`/activities/${activity.id}`, request.url));
}
