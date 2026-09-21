import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { notify } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const assignment = await prisma.activityAssignment.findUnique({
    where: { id },
    include: { activity: true },
  });
  if (!assignment) {
    return NextResponse.redirect(new URL("/activities", request.url));
  }
  if (assignment.activity.managerAccountId !== active.account.id) {
    return NextResponse.redirect(
      new URL(`/activities/${assignment.activityId}?error=forbidden`, request.url),
    );
  }
  if (assignment.status !== "PROPOSED") {
    return NextResponse.redirect(new URL(`/activities/${assignment.activityId}`, request.url));
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "CANCELLED",
        decidedByAccountId: active.account.id,
        decidedAt: new Date(),
      },
    });

    // FR-10: 신청한 사람에게 배정 변경을 알린다.
    const applicantAccount = await tx.account.findUnique({ where: { subjectId: assignment.subjectId } });
    if (applicantAccount) {
      await notify(tx, {
        accountId: applicantAccount.id,
        type: "ASSIGNMENT_CHANGED",
        title: `"${assignment.activity.title}" 참여 신청이 거절되었습니다`,
        relatedEntityType: "Activity",
        relatedEntityId: assignment.activityId,
      });
    }
  });

  return NextResponse.redirect(new URL(`/activities/${assignment.activityId}`, request.url));
}
