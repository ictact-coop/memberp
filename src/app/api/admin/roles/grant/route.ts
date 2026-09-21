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
  const scopeActivityIdRaw = formData.get("scopeActivityId");
  const scopeOrgUnitIdRaw = formData.get("scopeOrgUnitId");
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

  const scopeActivityId =
    typeof scopeActivityIdRaw === "string" && scopeActivityIdRaw.trim() ? scopeActivityIdRaw.trim() : null;
  const scopeOrgUnitId =
    typeof scopeOrgUnitIdRaw === "string" && scopeOrgUnitIdRaw.trim() ? scopeOrgUnitIdRaw.trim() : null;
  // 활동과 기구는 화면에서 서로 다른 필드지만 실제로는 같은 "범위" 하나를 고르는
  // 것이므로, 둘 다 채워서 오면 어느 쪽인지 알 수 없어 거부한다.
  if (scopeActivityId && scopeOrgUnitId) {
    return NextResponse.redirect(new URL("/admin/roles?error=scope_ambiguous", request.url));
  }

  let scopeType: ScopeType = "GLOBAL";
  let scopeId: string | null = null;
  if (scopeActivityId) {
    const activity = await prisma.activity.findUnique({ where: { id: scopeActivityId } });
    if (!activity) {
      return NextResponse.redirect(new URL("/admin/roles?error=invalid_scope", request.url));
    }
    scopeType = "ACTIVITY";
    scopeId = scopeActivityId;
  } else if (scopeOrgUnitId) {
    const orgUnit = await prisma.subject.findUnique({ where: { id: scopeOrgUnitId } });
    if (!orgUnit || orgUnit.type !== "ORG_UNIT") {
      return NextResponse.redirect(new URL("/admin/roles?error=invalid_scope", request.url));
    }
    scopeType = "ORG_UNIT";
    scopeId = scopeOrgUnitId;
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
