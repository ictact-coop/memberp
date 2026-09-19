import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 분류 사용 중지 — 지운다면 그 분류를 이미 고른 사람·기구의 값이 무엇이었는지
// 알 수 없게 된다. 그래서 삭제 대신 active만 끈다: 새로 고를 때 선택지에서
// 빠지지만, 이미 그 라벨을 쓰던 사람·기구는 계속 그 값을 유지한다(레거시 값
// 취급 — src/lib/classification-labels.ts의 isAllowedControlledValue 참고).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  await prisma.classification.updateMany({ where: { id }, data: { active: false } });

  return NextResponse.redirect(new URL("/admin/classifications", request.url));
}
