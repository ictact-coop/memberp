import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { isClassificationDomain, relabelSubjectsForClassification } from "@/lib/classification-labels";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 분류 병합 확정 — 같은 종류(domain) 안에서 중복 등록된 두 항목을 하나로
// 합친다. 기구·사람 병합과 원리는 같지만(없앨 쪽을 지우지 않고 참조만
// 옮긴 뒤 물러나게 한다), 여기서는 두 가지를 함께 옮겨야 한다:
//   1) ActivityClassification.classificationId — Classification.id를 참조하는
//      진짜 외래키라 그대로 재대입한다. 단, 같은 활동이 source·target 둘 다에
//      이미 연결돼 있으면(중복 태깅) 유일 제약(activityId, classificationId)에
//      걸리므로, 그 경우는 source 쪽 연결을 지우고 target 연결만 남긴다.
//   2) Subject.region/expertiseTags — label 문자열 값 자체를 옮긴다
//      (relabelSubjectsForClassification, 위 update 라우트와 동일한 헬퍼).
// source는 삭제하지 않고 사용 중지(active=false)로 물러나게 한다 — 이미 있는
// "사용 중지" 개념을 그대로 재사용한다(별도 archivedAt 필드가 없다).
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
    return NextResponse.redirect(new URL("/admin/classifications/merge?error=invalid", request.url));
  }
  if (sourceIdRaw === targetIdRaw) {
    return NextResponse.redirect(new URL("/admin/classifications/merge?error=same_classification", request.url));
  }

  const [source, target] = await Promise.all([
    prisma.classification.findUnique({ where: { id: sourceIdRaw } }),
    prisma.classification.findUnique({ where: { id: targetIdRaw } }),
  ]);
  if (!source || !target) {
    return NextResponse.redirect(new URL("/admin/classifications/merge?error=not_found", request.url));
  }
  if (source.domain !== target.domain) {
    return NextResponse.redirect(new URL("/admin/classifications/merge?error=domain_mismatch", request.url));
  }
  if (!target.active) {
    return NextResponse.redirect(new URL("/admin/classifications/merge?error=target_inactive", request.url));
  }

  await prisma.$transaction(async (tx) => {
    const sourceLinks = await tx.activityClassification.findMany({
      where: { classificationId: source.id },
      select: { id: true, activityId: true },
    });
    const targetActivityIds = new Set(
      (
        await tx.activityClassification.findMany({
          where: { classificationId: target.id },
          select: { activityId: true },
        })
      ).map((link) => link.activityId),
    );
    const duplicateLinkIds = sourceLinks
      .filter((link) => targetActivityIds.has(link.activityId))
      .map((link) => link.id);
    const reassignableLinkIds = sourceLinks
      .filter((link) => !targetActivityIds.has(link.activityId))
      .map((link) => link.id);

    if (duplicateLinkIds.length > 0) {
      await tx.activityClassification.deleteMany({ where: { id: { in: duplicateLinkIds } } });
    }
    if (reassignableLinkIds.length > 0) {
      await tx.activityClassification.updateMany({
        where: { id: { in: reassignableLinkIds } },
        data: { classificationId: target.id },
      });
    }

    const affectedSubjects = isClassificationDomain(source.domain)
      ? await relabelSubjectsForClassification(tx, source.domain, source.label, target.label)
      : 0;

    if (source.active) {
      await tx.classification.update({ where: { id: source.id }, data: { active: false } });
    }

    await tx.auditLog.create({
      data: {
        entityType: "Classification",
        entityId: source.id,
        action: "ARCHIVE",
        actorAccountId: active.account.id,
        beforeData: { active: source.active },
        afterData: { active: false, mergedIntoClassificationId: target.id, affectedSubjects },
        reason: `분류 병합: ${target.code} · ${target.label}으로 합치고 사용 중지함`,
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/classifications", request.url));
}
