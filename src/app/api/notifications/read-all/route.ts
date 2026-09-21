import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  await prisma.notification.updateMany({
    where: { accountId: active.account.id, status: { not: "READ" } },
    data: { status: "READ", readAt: new Date() },
  });

  return NextResponse.redirect(new URL("/my/notifications", request.url));
}
