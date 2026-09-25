import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { ACCOUNT_STATUS_TRANSITIONS, type AccountStatusAction } from "@/lib/account-status";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;
const VALID_ACTIONS = Object.keys(ACCOUNT_STATUS_TRANSITIONS) as AccountStatusAction[];

// FR-01 계정 상태 관리. getActiveSession()이 매 요청마다 status==="ACTIVE"를
// 확인하므로(session.ts), 여기서 상태만 바꾸면 그 순간부터 접근이 막히거나
// 풀린다 — 세션을 따로 폐기하는 코드가 필요 없다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;

  // 관리자 스스로 자기 계정 상태를 바꿔 잠기는 것을 막는다 — 역할 종료의
  // "마지막 관리자 권한 자기 회수 방지"보다 더 단순하고 확실한 규칙이다: 계정
  // 상태는 역할과 달리 그 사람 전체의 접근을 막으므로, 다른 관리자가 남아
  // 있는지와 무관하게 자기 자신에게는 아예 적용할 수 없게 한다.
  if (id === active.account.id) {
    return NextResponse.redirect(new URL("/admin/accounts?error=cannot_change_self", request.url));
  }

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.redirect(new URL("/admin/accounts", request.url));
  }

  const formData = await request.formData();
  const actionRaw = formData.get("action");
  const reasonRaw = formData.get("reason");

  if (typeof actionRaw !== "string" || !VALID_ACTIONS.includes(actionRaw as AccountStatusAction)) {
    return NextResponse.redirect(new URL("/admin/accounts?error=invalid_transition", request.url));
  }
  const action = actionRaw as AccountStatusAction;
  const rule = ACCOUNT_STATUS_TRANSITIONS[action];

  if (!rule.from.includes(account.status)) {
    return NextResponse.redirect(new URL("/admin/accounts?error=invalid_transition", request.url));
  }

  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (rule.reasonRequired && !reason) {
    return NextResponse.redirect(new URL("/admin/accounts?error=reason_required", request.url));
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id }, data: { status: rule.to } });
    await tx.auditLog.create({
      data: {
        entityType: "Account",
        entityId: id,
        action: "STATUS_CHANGE",
        actorAccountId: active.account.id,
        beforeData: { status: account.status },
        afterData: { status: rule.to },
        reason: reason || null,
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/accounts", request.url));
}
