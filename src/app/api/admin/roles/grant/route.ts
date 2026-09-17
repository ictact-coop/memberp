import { NextResponse } from "next/server";
import { PermissionRole, ScopeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES: PermissionRole[] = ["SECRETARIAT", "SYSTEM_ADMIN"];

// 페이지(/admin/roles)에서도 같은 역할을 요구하지만, 폼 POST는 화면 렌더링을 거치지
// 않고 바로 이 라우트로 올 수 있어 여기서도 다시 확인한다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, ADMIN_ROLES))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const formData = await request.formData();
  const accountId = formData.get("accountId");
  const roleRaw = formData.get("role");
  const scopeTypeRaw = formData.get("scopeType");
  const scopeIdRaw = formData.get("scopeId");
  const startDateRaw = formData.get("startDate");
  const endDateRaw = formData.get("endDate");

  const isValidRole =
    typeof roleRaw === "string" && (Object.values(PermissionRole) as string[]).includes(roleRaw);
  if (typeof accountId !== "string" || !accountId || !isValidRole) {
    return NextResponse.redirect(new URL("/admin/roles?error=invalid", request.url));
  }

  const targetAccount = await prisma.account.findUnique({ where: { id: accountId } });
  if (!targetAccount) {
    return NextResponse.redirect(new URL("/admin/roles?error=invalid", request.url));
  }

  const scopeType: ScopeType =
    typeof scopeTypeRaw === "string" &&
    (Object.values(ScopeType) as string[]).includes(scopeTypeRaw)
      ? (scopeTypeRaw as ScopeType)
      : "GLOBAL";
  const scopeId =
    scopeType !== "GLOBAL" && typeof scopeIdRaw === "string" && scopeIdRaw.trim()
      ? scopeIdRaw.trim()
      : null;
  // 범위를 특정 활동/기구로 지정했다면 ID를 반드시 함께 받는다 — 범위만 있고
  // 대상이 없으면 사실상 GLOBAL과 구분이 안 되는 애매한 부여가 된다.
  if (scopeType !== "GLOBAL" && !scopeId) {
    return NextResponse.redirect(new URL("/admin/roles?error=scope_id_required", request.url));
  }

  const startDate =
    typeof startDateRaw === "string" && startDateRaw ? new Date(startDateRaw) : new Date();
  const endDate = typeof endDateRaw === "string" && endDateRaw ? new Date(endDateRaw) : null;

  await prisma.permissionGrant.create({
    data: {
      accountId,
      role: roleRaw as PermissionRole,
      scopeType,
      scopeId,
      startDate,
      endDate,
      grantedByAccountId: active.account.id,
    },
  });

  return NextResponse.redirect(new URL("/admin/roles", request.url));
}
