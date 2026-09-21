import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// FR-05 참여 신청. 신청은 배정 상태를 PROPOSED로 만들 뿐이며, 그 자체가 실적이 되지
// 않는다(BR-02) — 실적은 기여(Contribution)로 별도 기록한다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!active.account.subjectId) {
    return NextResponse.redirect(new URL("/my/participation?error=no_subject", request.url));
  }
  const subjectId = active.account.subjectId;

  const formData = await request.formData();
  const activityId = formData.get("activityId");
  const role = formData.get("role");

  if (typeof activityId !== "string" || !activityId || typeof role !== "string" || !role) {
    return NextResponse.redirect(new URL("/activities?error=invalid", request.url));
  }

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    return NextResponse.redirect(new URL("/activities?error=invalid", request.url));
  }

  // 이미 진행 중인 신청·배정이 있으면 중복 신청을 막는다. 취소·종료된 이력이
  // 있어도 다시 신청할 수는 있다.
  const existingOpen = await prisma.activityAssignment.findFirst({
    where: {
      activityId,
      subjectId,
      status: { in: ["PROPOSED", "ACCEPTED", "IN_PROGRESS"] },
    },
  });
  if (existingOpen) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=already_applied`, request.url));
  }

  await prisma.activityAssignment.create({
    data: {
      activityId,
      subjectId,
      role,
      status: "PROPOSED",
    },
  });

  return NextResponse.redirect(new URL(`/activities/${activityId}`, request.url));
}
