import type { PermissionRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "./session";

// v0.1 §4.10 권한표: 계정별 역할·담당 범위·기간을 PermissionGrant에 기록한다.
// 기간이 지난 부여는 자동으로 제외된다 — 임기가 끝난 임원이 계속 권한을 갖지 않도록.
export async function getActiveRoles(accountId: string): Promise<PermissionRole[]> {
  const now = new Date();
  const grants = await prisma.permissionGrant.findMany({
    where: {
      accountId,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { role: true },
  });
  return grants.map((grant) => grant.role);
}

export async function hasAnyRole(accountId: string, roles: PermissionRole[]): Promise<boolean> {
  if (roles.length === 0) return false;
  const now = new Date();
  const grant = await prisma.permissionGrant.findFirst({
    where: {
      accountId,
      role: { in: roles },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { id: true },
  });
  return grant !== null;
}

// (protected) 화면에서 "이 역할이 있어야만 들어올 수 있다"를 강제할 때 쓴다.
// 권한이 없으면 /login이 아니라 /forbidden으로 보낸다 — 이미 로그인은 되어 있고
// 단지 권한이 없는 것이므로, 로그인 화면으로 돌려보내는 건 잘못된 안내다.
export async function requireRole(roles: PermissionRole[]) {
  const active = await requireActiveSession();
  const allowed = await hasAnyRole(active.account.id, roles);
  if (!allowed) {
    redirect("/forbidden");
  }
  return active;
}

// 담당자 확인함(/review)은 두 가지 방식 중 하나로 접근 자격을 얻는다:
// 1) 역할 부여(ACTIVITY_MANAGER 등)를 받았거나
// 2) 실제로 활동·수요에 담당자로 지정되어 있거나(Activity.managerAccountId 등)
// 활동 생성 화면이 아직 없어 담당자 지정이 별도 역할 부여 없이 이뤄질 수 있으므로,
// 역할만으로 제한하면 실제 담당자가 자기 활동을 확인하지 못하는 상황이 생긴다.
const REVIEW_ROLES: PermissionRole[] = [
  "ACTIVITY_MANAGER",
  "DOMAIN_OPERATOR",
  "SECRETARIAT",
  "BOARD",
  "SYSTEM_ADMIN",
];

export async function canAccessReviewInbox(accountId: string): Promise<boolean> {
  const [hasElevatedRole, managesActivity, assignedNeed] = await Promise.all([
    hasAnyRole(accountId, REVIEW_ROLES),
    prisma.activity.findFirst({ where: { managerAccountId: accountId }, select: { id: true } }),
    prisma.need.findFirst({ where: { assigneeAccountId: accountId }, select: { id: true } }),
  ]);
  return hasElevatedRole || managesActivity !== null || assignedNeed !== null;
}
