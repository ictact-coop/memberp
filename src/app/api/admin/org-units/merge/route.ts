import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { reassignSubjectReferences } from "@/lib/subject-merge";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 기구 병합 확정. 화면(/admin/org-units/merge)의 미리보기 폼에서만 오는 것을
// 전제하지만, 폼 POST는 화면 렌더링을 거치지 않고 바로 올 수 있어 여기서도
// 화면과 같은 검증을 다시 한다. source를 가리키던 모든 참조를 target으로
// 옮긴 뒤 source를 보관(archive)한다 — 실제로 지우지 않는다(v0.1 §2.1).
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const formData = await request.formData();
  const sourceIdRaw = formData.get("sourceId");
  const targetIdRaw = formData.get("targetId");

  if (typeof sourceIdRaw !== "string" || !sourceIdRaw || typeof targetIdRaw !== "string" || !targetIdRaw) {
    return NextResponse.redirect(new URL("/admin/org-units/merge?error=invalid", request.url));
  }
  if (sourceIdRaw === targetIdRaw) {
    return NextResponse.redirect(new URL("/admin/org-units/merge?error=same_subject", request.url));
  }

  const [source, target] = await Promise.all([
    prisma.subject.findUnique({ where: { id: sourceIdRaw } }),
    prisma.subject.findUnique({ where: { id: targetIdRaw } }),
  ]);
  if (!source || !target || source.type !== "ORG_UNIT" || target.type !== "ORG_UNIT") {
    return NextResponse.redirect(new URL("/admin/org-units/merge?error=not_found", request.url));
  }
  if (source.archivedAt || target.archivedAt) {
    return NextResponse.redirect(new URL("/admin/org-units/merge?error=archived", request.url));
  }

  // Account.subjectId는 유일 제약이다 — 두 기구 모두에 로그인 계정이 연결돼
  // 있으면(원래는 기구가 로그인할 일이 없어 생기지 않아야 하는 상태다) 하나로
  // 합칠 수 없다. 트랜잭션 안에서 실패하게 두는 대신 미리 걸러 분명한 이유를
  // 보여준다.
  const [sourceAccount, targetAccount] = await Promise.all([
    prisma.account.findUnique({ where: { subjectId: source.id } }),
    prisma.account.findUnique({ where: { subjectId: target.id } }),
  ]);
  if (sourceAccount && targetAccount) {
    return NextResponse.redirect(new URL("/admin/org-units/merge?error=account_conflict", request.url));
  }

  const archivedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await reassignSubjectReferences(tx, source.id, target.id);
    if (sourceAccount) {
      await tx.account.update({ where: { id: sourceAccount.id }, data: { subjectId: target.id } });
    }

    await tx.subject.update({
      where: { id: source.id },
      data: { archivedAt, updatedBy: active.account.id },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Subject",
        entityId: source.id,
        action: "ARCHIVE",
        actorAccountId: active.account.id,
        reason: `기구 병합: ${target.displayId} · ${target.name}으로 참조를 옮기고 보관함`,
        beforeData: { archivedAt: null },
        afterData: { archivedAt, mergedIntoSubjectId: target.id },
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/org-units", request.url));
}
