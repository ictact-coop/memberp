import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { reassignSubjectReferences } from "@/lib/subject-merge";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 사람 주체 병합 확정 — 기구 병합(api/admin/org-units/merge)과 같은 원리를
// src/lib/subject-merge.ts로 공유한다. 다른 점은 둘 다 계정이 있는 경우를
// "정상 범위 밖"으로 보고 막는다는 것 — 어느 로그인 정체성을 남길지는 이
// 화면이 대신 정할 문제가 아니다.
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
    return NextResponse.redirect(new URL("/admin/subjects/merge?error=invalid", request.url));
  }
  if (sourceIdRaw === targetIdRaw) {
    return NextResponse.redirect(new URL("/admin/subjects/merge?error=same_subject", request.url));
  }

  const [source, target] = await Promise.all([
    prisma.subject.findUnique({ where: { id: sourceIdRaw } }),
    prisma.subject.findUnique({ where: { id: targetIdRaw } }),
  ]);
  if (!source || !target || source.type !== "PERSON" || target.type !== "PERSON") {
    return NextResponse.redirect(new URL("/admin/subjects/merge?error=not_found", request.url));
  }
  if (source.archivedAt || target.archivedAt) {
    return NextResponse.redirect(new URL("/admin/subjects/merge?error=archived", request.url));
  }

  // 사람은 로그인 계정이 있는 것이 정상이라, 기구 병합과 달리 "둘 다 계정이
  // 있는 경우"를 실제로 자주 마주친다. 어느 계정(로그인 정체성)을 남길지는
  // 조합의 판단이 필요한 문제라 이 화면에서 자동으로 정하지 않고 막는다.
  const [sourceAccount, targetAccount] = await Promise.all([
    prisma.account.findUnique({ where: { subjectId: source.id } }),
    prisma.account.findUnique({ where: { subjectId: target.id } }),
  ]);
  if (sourceAccount && targetAccount) {
    return NextResponse.redirect(new URL("/admin/subjects/merge?error=account_conflict", request.url));
  }

  const archivedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await reassignSubjectReferences(tx, source.id, target.id);
    if (sourceAccount) {
      await tx.account.update({ where: { id: sourceAccount.id }, data: { subjectId: target.id } });
    }

    // 이름이 다르면 옛 이름을 잃지 않도록 target의 이전 이름 목록에 남긴다 —
    // 내 정보 수정 시 이름을 바꿀 때와 같은 규칙(previousNames).
    if (source.name !== target.name && !target.previousNames.includes(source.name)) {
      await tx.subject.update({
        where: { id: target.id },
        data: { previousNames: { push: source.name } },
      });
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
        reason: `사람 병합: ${target.displayId} · ${target.name}으로 참조를 옮기고 보관함`,
        beforeData: { archivedAt: null },
        afterData: { archivedAt, mergedIntoSubjectId: target.id },
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/subjects", request.url));
}
