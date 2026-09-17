import { NextResponse } from "next/server";
import { CompensationBasis, ContributionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { nextDisplayId } from "@/lib/display-id";

// target 필드는 "activity:<id>" 또는 "need:<id>" 형태의 단일 선택값을 인코딩한다 —
// 활동/필요 두 목록을 하나의 드롭다운으로 합쳐 "1분 기록"의 단순함을 지킨다.
function parseTarget(raw: FormDataEntryValue | null): { activityId: string | null; needId: string | null } {
  if (typeof raw !== "string" || !raw) return { activityId: null, needId: null };
  const [kind, refId] = raw.split(":");
  if (kind === "activity" && refId) return { activityId: refId, needId: null };
  if (kind === "need" && refId) return { activityId: null, needId: refId };
  return { activityId: null, needId: null };
}

export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!active.account.subjectId) {
    return NextResponse.redirect(new URL("/my/contributions/new?error=no_subject", request.url));
  }
  const contributorSubjectId = active.account.subjectId;

  const formData = await request.formData();
  const intent = formData.get("intent");
  const submissionKey = formData.get("submissionKey");
  const revisionOfIdRaw = formData.get("revisionOfId");

  if (typeof submissionKey !== "string" || !submissionKey) {
    return NextResponse.redirect(new URL("/my/contributions/new?error=invalid", request.url));
  }

  const { activityId, needId } = parseTarget(formData.get("target"));

  const performedDateRaw = formData.get("performedDate");
  const performedDate =
    typeof performedDateRaw === "string" && performedDateRaw ? new Date(performedDateRaw) : new Date();

  const contributionTypeRaw = formData.get("contributionType");
  const contributionType =
    typeof contributionTypeRaw === "string" &&
    (Object.values(ContributionType) as string[]).includes(contributionTypeRaw)
      ? (contributionTypeRaw as ContributionType)
      : ContributionType.TIME;

  const minutesRaw = formData.get("minutes");
  let minutes: number | null = null;
  if (typeof minutesRaw === "string" && minutesRaw.trim() !== "") {
    const parsed = Number(minutesRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.redirect(new URL("/my/contributions/new?error=invalid_minutes", request.url));
    }
    minutes = Math.round(parsed);
  }

  const compensationBasisRaw = formData.get("compensationBasis");
  const compensationBasis =
    typeof compensationBasisRaw === "string" &&
    (Object.values(CompensationBasis) as string[]).includes(compensationBasisRaw)
      ? (compensationBasisRaw as CompensationBasis)
      : CompensationBasis.UNCONFIRMED;

  const descriptionRaw = formData.get("description");
  const description = typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";

  const isSubmit = intent === "submit";

  // BR-01: 제출에는 활동 또는 필요 연결이 필요하다. 임시저장은 없어도 된다.
  if (isSubmit && !activityId && !needId) {
    return NextResponse.redirect(new URL("/my/contributions/new?error=target_required", request.url));
  }
  if (isSubmit && !description) {
    return NextResponse.redirect(new URL("/my/contributions/new?error=description_required", request.url));
  }

  const fields = {
    activityId,
    needId,
    performedDate,
    contributionType,
    minutes,
    compensationBasis,
    description: description || null,
  };

  const existing = await prisma.contribution.findUnique({ where: { submissionKey } });

  if (existing) {
    if (existing.contributorSubjectId !== contributorSubjectId) {
      return NextResponse.redirect(new URL("/my/contributions/new?error=forbidden", request.url));
    }
    if (existing.status !== "DRAFT" && existing.status !== "NEEDS_REVISION") {
      // BR-06: 이미 처리된 제출을 다시 눌러도 새 레코드를 만들지 않고 조용히 넘어간다.
      return NextResponse.redirect(new URL("/my/contributions", request.url));
    }
    await prisma.contribution.update({
      where: { id: existing.id },
      data: {
        ...fields,
        status: isSubmit ? "SUBMITTED" : existing.status,
        submittedAt: isSubmit ? new Date() : existing.submittedAt,
      },
    });
    return NextResponse.redirect(new URL("/my/contributions", request.url));
  }

  const revisionOfId = typeof revisionOfIdRaw === "string" && revisionOfIdRaw ? revisionOfIdRaw : null;
  if (revisionOfId) {
    const original = await prisma.contribution.findUnique({ where: { id: revisionOfId } });
    if (!original || original.contributorSubjectId !== contributorSubjectId || original.status !== "CONFIRMED") {
      return NextResponse.redirect(new URL("/my/contributions/new?error=invalid", request.url));
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const displayId = await nextDisplayId(tx, "CONT");
      await tx.contribution.create({
        data: {
          displayId,
          submissionKey,
          contributorSubjectId,
          authorAccountId: active.account.id,
          revisionOfId,
          ...fields,
          status: isSubmit ? "SUBMITTED" : "DRAFT",
          submittedAt: isSubmit ? new Date() : null,
        },
      });
    });
  } catch (error) {
    // BR-06/AT-04: 제출 버튼을 거의 동시에 두 번 눌러 두 요청이 모두 "아직 없음"을
    // 보고 각자 생성을 시도하면, 나중 요청은 submissionKey 유일 제약 위반(P2002)으로
    // 실패한다 — 오류가 아니라 이미 처리된 제출로 취급한다.
    const isUniqueViolation =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";
    if (!isUniqueViolation) throw error;
  }

  return NextResponse.redirect(new URL("/my/contributions", request.url));
}
