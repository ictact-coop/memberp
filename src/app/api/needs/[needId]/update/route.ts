import { NextResponse } from "next/server";
import { NeedChannel, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { notify } from "@/lib/notifications";

// FR-08 상담·수요 수정. 접수(create)와 같은 필수 필드 검증을 쓴다. 권한·잠금
// 규칙은 활동 수정과 같은 원칙: 그 상담·수요의 담당자만, 그리고 사업화·종결된
// 건은 수정할 수 없다(상태 전이 전용 필드인 다음 행동·종결유형 등은 여기서
// 건드리지 않는다 — /transition이 계속 관리한다).
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
  if (need.assigneeAccountId !== active.account.id) {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=forbidden`, request.url));
  }
  if (need.status === "CLOSED" || need.status === "CONVERTED") {
    return NextResponse.redirect(new URL(`/needs/${needId}?error=locked`, request.url));
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
    return NextResponse.redirect(new URL(`/needs/${needId}/edit?error=invalid`, request.url));
  }

  const assignee = await prisma.account.findUnique({ where: { id: assigneeAccountId } });
  if (!assignee) {
    return NextResponse.redirect(new URL(`/needs/${needId}/edit?error=invalid_assignee`, request.url));
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
    return NextResponse.redirect(new URL(`/needs/${needId}/edit?error=invalid_budget`, request.url));
  }

  await prisma.$transaction(async (tx) => {
    await tx.need.update({
      where: { id: needId },
      data: {
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
        updatedBy: active.account.id,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Need",
        entityId: needId,
        action: "UPDATE",
        actorAccountId: active.account.id,
        beforeData: {
          title: need.title,
          content: need.content,
          channel: need.channel,
          receivedAt: need.receivedAt,
          assigneeAccountId: need.assigneeAccountId,
          raisedBySubjectId: need.raisedBySubjectId,
          beneficiarySubjectId: need.beneficiarySubjectId,
          urgency: need.urgency,
          budgetMin: need.budgetMin,
          budgetMax: need.budgetMax,
          visibility: need.visibility,
        },
        afterData: {
          title: title.trim(),
          content: content.trim(),
          channel: channelRaw,
          receivedAt: receivedAtRaw,
          assigneeAccountId,
          raisedBySubjectId,
          beneficiarySubjectId,
          urgency,
          budgetMin,
          budgetMax,
          visibility,
        },
      },
    });

    // FR-10: 담당자가 바뀌었으면 새 담당자에게 알린다(본인이 스스로에게
    // 넘긴 경우는 알릴 필요가 없다).
    if (assigneeAccountId !== need.assigneeAccountId && assigneeAccountId !== active.account.id) {
      await notify(tx, {
        accountId: assigneeAccountId,
        type: "NEED_ASSIGNED",
        title: `${need.displayId} 상담·수요 담당자로 지정되었습니다`,
        relatedEntityType: "Need",
        relatedEntityId: needId,
      });
    }
  });

  return NextResponse.redirect(new URL(`/needs/${needId}`, request.url));
}
