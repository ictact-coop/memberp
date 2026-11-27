import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 관계 등록 — fromSubject(이 상세화면의 주체) 기준으로 상대 주체와의 관계
// 한 건을 만든다. 관계가 늘 대칭은 아니므로(예: "소속") 반대 방향을 자동으로
// 만들지 않는다 — 필요하면 상대 쪽 상세화면에서 한 번 더 등록한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id: fromSubjectId } = await params;
  const fromSubject = await prisma.subject.findUnique({ where: { id: fromSubjectId } });
  if (!fromSubject) {
    return NextResponse.redirect(new URL("/admin/subjects", request.url));
  }
  const errorUrl = (error: string) =>
    new URL(`/admin/subjects/${fromSubjectId}?error=${error}`, request.url);
  if (fromSubject.archivedAt) {
    return NextResponse.redirect(errorUrl("archived"));
  }

  const formData = await request.formData();
  const toSubjectIdRaw = formData.get("toSubjectId");
  const classificationIdRaw = formData.get("classificationId");
  const roleRaw = formData.get("role");
  const startDateRaw = formData.get("startDate");
  const endDateRaw = formData.get("endDate");
  const noteRaw = formData.get("note");

  if (typeof toSubjectIdRaw !== "string" || !toSubjectIdRaw) {
    return NextResponse.redirect(errorUrl("invalid"));
  }
  if (toSubjectIdRaw === fromSubjectId) {
    return NextResponse.redirect(errorUrl("same_subject"));
  }
  const toSubject = await prisma.subject.findUnique({ where: { id: toSubjectIdRaw } });
  if (!toSubject || toSubject.archivedAt) {
    return NextResponse.redirect(errorUrl("invalid_subject"));
  }

  if (typeof classificationIdRaw !== "string" || !classificationIdRaw) {
    return NextResponse.redirect(errorUrl("invalid"));
  }
  const classification = await prisma.classification.findUnique({ where: { id: classificationIdRaw } });
  if (!classification || classification.domain !== "RELATIONSHIP_TYPE" || !classification.active) {
    return NextResponse.redirect(errorUrl("invalid_type"));
  }

  const startDate = typeof startDateRaw === "string" && startDateRaw ? new Date(startDateRaw) : new Date();
  const endDate = typeof endDateRaw === "string" && endDateRaw ? new Date(endDateRaw) : null;
  if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
    return NextResponse.redirect(errorUrl("invalid_dates"));
  }
  if (endDate && endDate < startDate) {
    return NextResponse.redirect(errorUrl("invalid_dates"));
  }
  const role = typeof roleRaw === "string" && roleRaw.trim() ? roleRaw.trim() : null;
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : null;

  const relationship = await prisma.relationship.create({
    data: {
      fromSubjectId,
      toSubjectId: toSubjectIdRaw,
      classificationId: classificationIdRaw,
      role,
      startDate,
      endDate,
      note,
      createdBy: active.account.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "Relationship",
      entityId: relationship.id,
      action: "CREATE",
      actorAccountId: active.account.id,
      afterData: {
        fromSubjectId,
        toSubjectId: toSubjectIdRaw,
        classificationId: classificationIdRaw,
        role,
        startDate,
        endDate,
      },
    },
  });

  return NextResponse.redirect(new URL(`/admin/subjects/${fromSubjectId}`, request.url));
}
