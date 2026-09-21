import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// 알림 읽음 처리 — 받은 사람 본인만 자기 알림을 읽음으로 표시할 수 있다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  await prisma.notification.updateMany({
    where: { id, accountId: active.account.id },
    data: { status: "READ", readAt: new Date() },
  });

  return NextResponse.redirect(new URL("/my/notifications", request.url));
}
