import { NextResponse } from "next/server";
import { NeedChannel, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { ACTIVITY_OPERATIONS_ROLES, hasAnyRole } from "@/lib/auth/roles";
import { nextDisplayId } from "@/lib/display-id";

// FR-08 상담·수요 접수. v0.1 §3.1 A02: 담당(수행자)이 있어야 "접수→확인중" 전이의
// 조건(담당·다음 행동일)을 나중에 채울 수 있으므로 담당자는 등록 시 필수로 받는다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, ACTIVITY_OPERATIONS_ROLES))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const formData = await request.formData();
  const title = formData.get("title");
  const content = formData.get("content");
  const channelRaw = formData.get("channel");
  const receivedAtRaw = formData.get("receivedAt");
  const assigneeAccountId = formData.get("assigneeAccountId");
  const raisedBySubjectIdRaw = formData.get("raisedBySubjectId");
  const beneficiarySubjectIdRaw = formData.get("beneficiarySubjectId");
  const urgencyRaw = formData.get("urgency");
  const visibilityRaw = formData.get("visibility");
  const budgetMinRaw = formData.get("budgetMin");
  const budgetMaxRaw = formData.get("budgetMax");

  const isValidChannel =
    typeof channelRaw === "string" && (Object.values(NeedChannel) as string[]).includes(channelRaw);

  if (
    typeof title !== "string" ||
    !title.trim() ||
    typeof content !== "string" ||
    !content.trim() ||
    !isValidChannel ||
    typeof receivedAtRaw !== "string" ||
    !receivedAtRaw ||
    typeof assigneeAccountId !== "string" ||
    !assigneeAccountId
  ) {
    return NextResponse.redirect(new URL("/needs/new?error=invalid", request.url));
  }

  const assignee = await prisma.account.findUnique({ where: { id: assigneeAccountId } });
  if (!assignee) {
    return NextResponse.redirect(new URL("/needs/new?error=invalid_assignee", request.url));
  }

  const raisedBySubjectId =
    typeof raisedBySubjectIdRaw === "string" && raisedBySubjectIdRaw ? raisedBySubjectIdRaw : null;
  const beneficiarySubjectId =
    typeof beneficiarySubjectIdRaw === "string" && beneficiarySubjectIdRaw
      ? beneficiarySubjectIdRaw
      : null;

  const visibility: Visibility =
    typeof visibilityRaw === "string" && (Object.values(Visibility) as string[]).includes(visibilityRaw)
      ? (visibilityRaw as Visibility)
      : "TEAM";
  const urgency = typeof urgencyRaw === "string" && urgencyRaw.trim() ? urgencyRaw.trim() : null;
  const budgetMin = typeof budgetMinRaw === "string" && budgetMinRaw ? budgetMinRaw : null;
  const budgetMax = typeof budgetMaxRaw === "string" && budgetMaxRaw ? budgetMaxRaw : null;
  if (budgetMin && budgetMax && Number(budgetMax) < Number(budgetMin)) {
    return NextResponse.redirect(new URL("/needs/new?error=invalid_budget", request.url));
  }

  const need = await prisma.$transaction(async (tx) => {
    const displayId = await nextDisplayId(tx, "NEED");
    return tx.need.create({
      data: {
        displayId,
        title: title.trim(),
        content: content.trim(),
        channel: channelRaw as NeedChannel,
        receivedAt: new Date(receivedAtRaw),
        assigneeAccountId,
        raisedBySubjectId,
        beneficiarySubjectId,
        urgency,
        budgetMin,
        budgetMax,
        visibility,
        status: "RECEIVED",
        createdBy: active.account.id,
      },
    });
  });

  return NextResponse.redirect(new URL(`/needs/${need.id}`, request.url));
}
