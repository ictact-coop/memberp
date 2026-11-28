import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { TASK_TRANSITIONS, type TaskTransitionAction } from "@/lib/task-status";

const VALID_ACTIONS = Object.keys(TASK_TRANSITIONS) as TaskTransitionAction[];

// 업무 상태 전이 — 필요·활동 상태 전이와 같은 구조(규칙은 task-status.ts).
// 지금은 그 활동의 책임자만 업무 상태를 바꿀 수 있다(담당자 본인 자가
// 처리는 범위 밖으로 남겨둠 — Task 모델 주석 참고).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id }, include: { activity: true } });
  if (!task) {
    return NextResponse.redirect(new URL("/activities", request.url));
  }
  if (task.activity.managerAccountId !== active.account.id) {
    return NextResponse.redirect(new URL(`/activities/${task.activityId}?error=forbidden`, request.url));
  }

  const formData = await request.formData();
  const actionRaw = formData.get("action");
  const reasonRaw = formData.get("reason");

  if (typeof actionRaw !== "string" || !VALID_ACTIONS.includes(actionRaw as TaskTransitionAction)) {
    return NextResponse.redirect(
      new URL(`/activities/${task.activityId}?error=invalid_transition`, request.url),
    );
  }
  const action = actionRaw as TaskTransitionAction;
  const rule = TASK_TRANSITIONS[action];

  if (!rule.from.includes(task.status)) {
    return NextResponse.redirect(
      new URL(`/activities/${task.activityId}?error=invalid_transition`, request.url),
    );
  }

  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (rule.reasonRequired && !reason) {
    return NextResponse.redirect(
      new URL(`/activities/${task.activityId}?error=reason_required`, request.url),
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id },
      data: {
        status: rule.to,
        updatedBy: active.account.id,
        ...(action === "complete" ? { completedAt: new Date() } : {}),
        ...(action === "cancel" ? { cancelReason: reason } : {}),
        ...(action === "reopen" ? { completedAt: null, cancelReason: null } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Task",
        entityId: id,
        action: "STATUS_CHANGE",
        actorAccountId: active.account.id,
        beforeData: { status: task.status },
        afterData: { status: rule.to },
        reason: reason || null,
      },
    });
  });

  return NextResponse.redirect(new URL(`/activities/${task.activityId}`, request.url));
}
