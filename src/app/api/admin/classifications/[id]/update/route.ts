import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { isClassificationDomain, relabelSubjectsForClassification } from "@/lib/classification-labels";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 분류 라벨 수정(오타 정정 등) — 코드·종류는 그대로 두고 화면에 보일 이름만
// 바꾼다. Subject.region/expertiseTags는 Classification.id가 아니라 label
// 문자열을 그대로 복사해 저장하므로, 라벨을 바꾸면 이미 그 값을 쓰던 사람·
// 기구도 함께 옮겨야 예전 라벨을 쓴 것들이 "목록에 없는 값"으로 밀려나지
// 않는다(src/lib/classification-labels.ts의 relabelSubjectsForClassification).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  const formData = await request.formData();
  const labelRaw = formData.get("label");
  if (typeof labelRaw !== "string" || !labelRaw.trim()) {
    return NextResponse.redirect(new URL("/admin/classifications?error=invalid", request.url));
  }
  const newLabel = labelRaw.trim();

  const classification = await prisma.classification.findUnique({ where: { id } });
  if (!classification) {
    return NextResponse.redirect(new URL("/admin/classifications?error=not_found", request.url));
  }

  if (newLabel !== classification.label) {
    const duplicate = await prisma.classification.findFirst({
      where: { domain: classification.domain, label: newLabel, id: { not: id } },
    });
    if (duplicate) {
      return NextResponse.redirect(new URL("/admin/classifications?error=duplicate_label", request.url));
    }
  }

  const oldLabel = classification.label;
  if (oldLabel !== newLabel) {
    await prisma.$transaction(async (tx) => {
      await tx.classification.update({ where: { id }, data: { label: newLabel } });
      const affectedSubjects = isClassificationDomain(classification.domain)
        ? await relabelSubjectsForClassification(tx, classification.domain, oldLabel, newLabel)
        : 0;
      await tx.auditLog.create({
        data: {
          entityType: "Classification",
          entityId: id,
          action: "UPDATE",
          actorAccountId: active.account.id,
          beforeData: { label: oldLabel },
          afterData: { label: newLabel, affectedSubjects },
          reason: `분류 라벨 수정: ${oldLabel} → ${newLabel}`,
        },
      });
    });
  }

  return NextResponse.redirect(new URL("/admin/classifications", request.url));
}
