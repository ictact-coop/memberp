import { NextResponse } from "next/server";
import type { NeedStatus } from "@prisma/client";
import { NeedCloseType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { NEED_TRANSITIONS, type NeedTransitionAction } from "@/lib/need-status";

const VALID_ACTIONS = Object.keys(NEED_TRANSITIONS) as NeedTransitionAction[];

// FR-08 상담·수요 상태 전이 (v0.1 §3.1 구현). 활동 상태 전이와 같은 구조:
// 규칙은 need-status.ts에 있고, 여기서는 권한·현재 상태·전이별 필수 조건만 확인한다.
export async function POST(request: Request, { params }: { params: Promise<{ needId: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { needId } = await params;
  const need = await prisma.need.findUnique({ where: { id: needId } });
  if (!need) {
    return NextResponse.redirect(new URL("/needs", request.url));
  }

  // 활동 상태 전이와 같은 원칙: 그 상담·수요의 담당자만 상태를 바꿀 수 있다.
  if (need.assigneeAccountId !== active.account.id) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=forbidden`, request.url));
  }

  const formData = await request.formData();
  const actionRaw = formData.get("action");
  const reasonRaw = formData.get("reason");
  const reviewDateRaw = formData.get("reviewDate");
  const nextActionDateRaw = formData.get("nextActionDate");
  const beneficiarySubjectIdRaw = formData.get("beneficiarySubjectId");
  const nextActionRaw = formData.get("nextAction");
  const activityIdRaw = formData.get("activityId");
  const closeTypeRaw = formData.get("closeType");

  if (typeof actionRaw !== "string" || !VALID_ACTIONS.includes(actionRaw as NeedTransitionAction)) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=invalid_transition`, request.url));
  }
  const action = actionRaw as NeedTransitionAction;
  const rule = NEED_TRANSITIONS[action];

  if (!rule.from.includes(need.status)) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=invalid_transition`, request.url));
  }

  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (rule.reasonRequired && !reason) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=reason_required`, request.url));
  }

  const nextActionDate =
    typeof nextActionDateRaw === "string" && nextActionDateRaw ? new Date(nextActionDateRaw) : null;
  const beneficiarySubjectId =
    typeof beneficiarySubjectIdRaw === "string" && beneficiarySubjectIdRaw ? beneficiarySubjectIdRaw : null;
  const nextAction = typeof nextActionRaw === "string" && nextActionRaw.trim() ? nextActionRaw.trim() : null;

  // v0.1 §3.1: 접수→확인중은 "담당·다음 행동일"이 있어야 한다. 담당자는 등록 시
  // 이미 필수였으니 다음 행동일만 확인한다(레코드에 있거나 지금 같이 채우거나).
  if (action === "review" && !need.nextActionDate && !nextActionDate) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=missing_next_action_date`, request.url));
  }
  // 확인중→제안중은 "문제·대상·대안"이 있어야 한다. 문제(content)는 등록 시 이미
  // 필수이므로 대상(beneficiarySubjectId)·대안(nextAction)만 확인한다.
  if (action === "propose" && !need.beneficiarySubjectId && !beneficiarySubjectId) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=missing_proposal_fields`, request.url));
  }
  if (action === "propose" && !need.nextAction && !nextAction) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=missing_proposal_fields`, request.url));
  }
  if (beneficiarySubjectId) {
    const beneficiary = await prisma.subject.findUnique({ where: { id: beneficiarySubjectId } });
    if (!beneficiary) {
      return NextResponse.redirect(new URL(`/needs/${needId}?error=invalid_beneficiary`, request.url));
    }
  }

  let activityId: string | null = null;
  if (action === "convert") {
    if (typeof activityIdRaw !== "string" || !activityIdRaw) {
      return NextResponse.redirect(new URL(`/needs/${needId}?error=missing_activity`, request.url));
    }
    const activity = await prisma.activity.findUnique({ where: { id: activityIdRaw } });
    if (!activity) {
      return NextResponse.redirect(new URL(`/needs/${needId}?error=invalid_activity`, request.url));
    }
    activityId = activityIdRaw;
  }

  let closeType: NeedCloseType | null = null;
  if (action === "close") {
    if (
      typeof closeTypeRaw !== "string" ||
      !(Object.values(NeedCloseType) as string[]).includes(closeTypeRaw)
    ) {
      return NextResponse.redirect(new URL(`/needs/${needId}?error=invalid_close_type`, request.url));
    }
    closeType = closeTypeRaw as NeedCloseType;
  }

  const targetStatus: NeedStatus = rule.to;
  const reviewDate = typeof reviewDateRaw === "string" && reviewDateRaw ? reviewDateRaw : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.need.update({
      where: { id: needId },
      data: {
        status: targetStatus,
        updatedBy: active.account.id,
        ...(nextActionDate ? { nextActionDate } : {}),
        ...(beneficiarySubjectId ? { beneficiarySubjectId } : {}),
        ...(nextAction ? { nextAction } : {}),
        ...(action === "close" ? { closeType, closeReason: reason } : {}),
      },
    });

    if (action === "convert" && activityId) {
      try {
        await tx.needActivityLink.create({
          data: {
            needId,
            activityId,
            linkType: "PRIMARY",
            confirmedByAccountId: active.account.id,
          },
        });
      } catch (error) {
        // 동일 필요·활동·연결유형 조합은 유일해야 한다(v0.1 A-표) — 이미 연결돼
        // 있다면 새로 만들지 않고 조용히 넘어간다(중복 사업화 연결 방지).
        if (
          !(error && typeof error === "object" && "code" in error && error.code === "P2002")
        ) {
          throw error;
        }
      }
    }

    await tx.auditLog.create({
      data: {
        entityType: "Need",
        entityId: needId,
        action: "STATUS_CHANGE",
        actorAccountId: active.account.id,
        beforeData: { status: need.status },
        afterData: { status: targetStatus, ...(reviewDate ? { reviewDate } : {}) },
        reason: reason || null,
      },
    });
  });

  return NextResponse.redirect(new URL(`/needs/${needId}`, request.url));
}
