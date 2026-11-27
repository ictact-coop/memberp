import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { nextDisplayId } from "@/lib/display-id";

// 업무 등록 — 활동 정보 수정과 같은 권한·잠금 규칙: 그 활동의 책임자만,
// 종료·취소된 활동은 새 업무를 추가할 수 없다(정정 이력 몫인 활동 정보와
// 달리 업무는 그냥 막는다 — 이미 끝난 활동에 새 할 일을 만들 이유가 없다).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
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
  const titleRaw = formData.get("title");
  const descriptionRaw = formData.get("description");
  const assigneeAccountIdRaw = formData.get("assigneeAccountId");
  const dueDateRaw = formData.get("dueDate");

  if (typeof titleRaw !== "string" || !titleRaw.trim()) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=invalid_task`, request.url));
  }
  const title = titleRaw.trim();
  const description = typeof descriptionRaw === "string" && descriptionRaw.trim() ? descriptionRaw.trim() : null;

  const assigneeAccountId =
    typeof assigneeAccountIdRaw === "string" && assigneeAccountIdRaw ? assigneeAccountIdRaw : null;
  if (assigneeAccountId) {
    const assignee = await prisma.account.findUnique({ where: { id: assigneeAccountId } });
    if (!assignee) {
      return NextResponse.redirect(new URL(`/activities/${activityId}?error=invalid_assignee`, request.url));
    }
  }

  const dueDate = typeof dueDateRaw === "string" && dueDateRaw ? new Date(dueDateRaw) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=invalid_task`, request.url));
  }

  await prisma.$transaction(async (tx) => {
    const displayId = await nextDisplayId(tx, "TASK");
    const task = await tx.task.create({
      data: {
        displayId,
        activityId,
        title,
        description,
        assigneeAccountId,
        dueDate,
        createdBy: active.account.id,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Task",
        entityId: task.id,
        action: "CREATE",
        actorAccountId: active.account.id,
        afterData: { activityId, title, assigneeAccountId, dueDate },
      },
    });
  });

  return NextResponse.redirect(new URL(`/activities/${activityId}`, request.url));
}
