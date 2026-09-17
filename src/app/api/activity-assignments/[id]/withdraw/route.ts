import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// 본인이 넣은 신청만, 아직 결정되지 않았을 때만(PROPOSED) 스스로 철회할 수 있다.
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
  if (assignment.status !== "PROPOSED") {
    return NextResponse.redirect(new URL("/my/participation", request.url));
  }

  await prisma.activityAssignment.update({
    where: { id: assignment.id },
    data: {
      status: "CANCELLED",
      decidedByAccountId: active.account.id,
      decidedAt: new Date(),
    },
  });

  return NextResponse.redirect(new URL("/my/participation", request.url));
}
