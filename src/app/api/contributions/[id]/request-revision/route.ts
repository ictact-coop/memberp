import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { notify } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const formData = await request.formData();
  const reason = formData.get("reason");

  const contribution = await prisma.contribution.findUnique({
    where: { id },
    include: { activity: true, need: true },
  });
  if (!contribution) {
    return NextResponse.redirect(new URL("/review", request.url));
  }

  const isManager =
    contribution.activity?.managerAccountId === active.account.id ||
    contribution.need?.assigneeAccountId === active.account.id;
  if (!isManager) {
    return NextResponse.redirect(new URL("/review?error=forbidden", request.url));
  }
  if (contribution.status !== "SUBMITTED") {
    return NextResponse.redirect(new URL("/review", request.url));
  }

  const revisionReason = typeof reason === "string" && reason.trim() ? reason.trim() : null;

  await prisma.$transaction(async (tx) => {
    await tx.contribution.update({
      where: { id: contribution.id },
      data: { status: "NEEDS_REVISION", revisionReason },
    });

    // FR-10: 보완이 필요한 사람(=이 기여를 고칠 수 있는 사람)에게 알린다.
    // 대리입력이면 실제 기여자의 계정이 따로 없을 수 있어(§"기여 작성·확인
    // 흐름"), 그런 경우 알림을 만들 대상이 없어 조용히 넘어간다.
    const contributorAccount = await tx.account.findUnique({
      where: { subjectId: contribution.contributorSubjectId },
    });
    if (contributorAccount) {
      await notify(tx, {
        accountId: contributorAccount.id,
        type: "REVISION_REQUESTED",
        title: `${contribution.displayId} 보완 요청`,
        body: revisionReason ?? undefined,
        relatedEntityType: "Contribution",
        relatedEntityId: contribution.id,
      });
    }
  });

  return NextResponse.redirect(new URL("/review", request.url));
}
