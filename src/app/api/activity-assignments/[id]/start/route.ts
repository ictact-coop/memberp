import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// 배정 IN_PROGRESS 전환 — v0.1 A05의 배정상태(제안/수락/진행/종료/취소) 중 "진행".
// 수락(ACCEPTED)과 구분해, 실제로 일을 시작했는지는 본인이 제일 잘 알기 때문에
// 책임자가 아니라 본인이 스스로 전환한다(신청 철회와 같은 원칙).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const assignment = await prisma.activityAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return NextResponse.redirect(new URL("/my/participation", request.url));
  }
  if (assignment.subjectId !== active.account.subjectId) {
    return NextResponse.redirect(new URL("/my/participation?error=forbidden", request.url));
  }
  if (assignment.status !== "ACCEPTED") {
    return NextResponse.redirect(new URL("/my/participation", request.url));
  }

  await prisma.activityAssignment.update({
    where: { id: assignment.id },
    data: { status: "IN_PROGRESS" },
  });

  return NextResponse.redirect(new URL("/my/participation", request.url));
}
