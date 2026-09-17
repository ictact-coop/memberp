import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

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

  await prisma.activityAssignment.update({
    where: { id: assignment.id },
    data: {
      status: "CANCELLED",
      decidedByAccountId: active.account.id,
      decidedAt: new Date(),
    },
  });

  return NextResponse.redirect(new URL(`/activities/${assignment.activityId}`, request.url));
}
