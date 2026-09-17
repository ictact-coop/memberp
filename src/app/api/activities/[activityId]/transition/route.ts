import { NextResponse } from "next/server";
import type { ActivityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { ACTIVITY_TRANSITIONS, type ActivityTransitionAction } from "@/lib/activity-status";

const VALID_ACTIONS = Object.keys(ACTIVITY_TRANSITIONS) as ActivityTransitionAction[];

// FR-04 활동 상태 전이 (v0.1 §3.2 상태표 구현). 전이 규칙은 activity-status.ts에
// 있고, 여기서는 권한·현재 상태·필수 사유만 확인한 뒤 상태를 바꾸고 감사기록을 남긴다.
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

  // 참여 신청 수락·거절·종료와 같은 원칙: 그 활동의 책임자만 상태를 바꿀 수 있다.
  if (activity.managerAccountId !== active.account.id) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=forbidden`, request.url));
  }

  const formData = await request.formData();
  const actionRaw = formData.get("action");
  const reasonRaw = formData.get("reason");
  const reviewDateRaw = formData.get("reviewDate");

  if (typeof actionRaw !== "string" || !VALID_ACTIONS.includes(actionRaw as ActivityTransitionAction)) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=invalid_transition`, request.url));
  }
  const action = actionRaw as ActivityTransitionAction;
  const rule = ACTIVITY_TRANSITIONS[action];

  if (!rule.from.includes(activity.status)) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=invalid_transition`, request.url));
  }

  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (rule.reasonRequired && !reason) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=reason_required`, request.url));
  }

  // 승인대기로 넘어가려면 v0.1 §3.2가 요구하는 필드(책임자·목적·미션·예정기간)가
  // 다 있어야 한다 — 책임자·목적·미션은 등록 시 이미 필수였으므로 예정기간만 확인한다.
  if (action === "request_approval" && (!activity.plannedStartDate || !activity.plannedEndDate)) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=missing_planned_dates`, request.url));
  }

  let targetStatus: ActivityStatus;
  if (rule.to === "RESUME") {
    const holdEntry = await prisma.auditLog.findFirst({
      where: { entityType: "Activity", entityId: activityId, action: "STATUS_CHANGE" },
      orderBy: { occurredAt: "desc" },
    });
    const beforeStatus =
      holdEntry && typeof holdEntry.afterData === "object" && holdEntry.afterData !== null
        ? (holdEntry.afterData as { status?: string }).status
        : undefined;
    const resumeTarget =
      beforeStatus === "ON_HOLD" &&
      typeof holdEntry?.beforeData === "object" &&
      holdEntry.beforeData !== null
        ? (holdEntry.beforeData as { status?: ActivityStatus }).status
        : undefined;
    if (!resumeTarget) {
      return NextResponse.redirect(new URL(`/activities/${activityId}?error=invalid_transition`, request.url));
    }
    targetStatus = resumeTarget;
  } else {
    targetStatus = rule.to;
  }

  const reviewDate = typeof reviewDateRaw === "string" && reviewDateRaw ? reviewDateRaw : undefined;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.activity.update({
      where: { id: activityId },
      data: {
        status: targetStatus,
        updatedBy: active.account.id,
        ...(action === "start" ? { actualStartDate: activity.actualStartDate ?? now } : {}),
        ...(action === "close"
          ? { closeEvaluationNote: reason, closedAt: now, actualEndDate: activity.actualEndDate ?? now }
          : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Activity",
        entityId: activityId,
        action: "STATUS_CHANGE",
        actorAccountId: active.account.id,
        beforeData: { status: activity.status },
        afterData: { status: targetStatus, ...(reviewDate ? { reviewDate } : {}) },
        reason: reason || null,
      },
    });
  });

  return NextResponse.redirect(new URL(`/activities/${activityId}`, request.url));
}
