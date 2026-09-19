import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 사용 중지된 분류를 다시 선택지에 올린다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  await prisma.classification.updateMany({ where: { id }, data: { active: true } });

  return NextResponse.redirect(new URL("/admin/classifications", request.url));
}
