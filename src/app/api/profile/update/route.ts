import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { isAllowedControlledValue } from "@/lib/classification-labels";

// FR-03 내 정보 수정. v0.1 P01 필드 중 본인이 스스로 확정할 수 있는 것만 다룬다 —
// 활동 상태·책임 담당자는 조직이 관리하는 항목이라 여기서 건드리지 않는다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!active.account.subjectId) {
    return NextResponse.redirect(new URL("/my/profile?error=no_subject", request.url));
  }
  const subjectId = active.account.subjectId;

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return NextResponse.redirect(new URL("/my/profile?error=no_subject", request.url));
  }

  const formData = await request.formData();
  const nameRaw = formData.get("name");
  const regionRaw = formData.get("region");
  const expertiseTagValues = formData.getAll("expertiseTags");
  const contactRaw = formData.get("contact");
  const promotionalOptIn = formData.get("promotionalOptIn") === "on";

  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    return NextResponse.redirect(new URL("/my/profile?error=invalid", request.url));
  }
  const name = nameRaw.trim();

  // 지역·전문영역/관심은 분류표(Classification) 기반 선택형이다. 화면은 활성
  // 분류표 값과, 이 항목이 이미 갖고 있던 레거시 값만 선택지로 보여주므로,
  // 그 두 집합 밖의 값이 오면(직접 API 호출 등) 거부한다.
  const [regionOptions, expertiseOptions] = await Promise.all([
    prisma.classification.findMany({ where: { domain: "REGION", active: true }, select: { label: true } }),
    prisma.classification.findMany({ where: { domain: "EXPERTISE", active: true }, select: { label: true } }),
  ]);
  const allowedRegions = new Set(regionOptions.map((o) => o.label));
  const allowedExpertise = new Set(expertiseOptions.map((o) => o.label));
  const previousRegion = new Set(subject.region ? [subject.region] : []);
  const previousExpertiseTags = new Set(subject.expertiseTags);

  const region = typeof regionRaw === "string" && regionRaw.trim() ? regionRaw.trim() : null;
  if (region && !isAllowedControlledValue(region, allowedRegions, previousRegion)) {
    return NextResponse.redirect(new URL("/my/profile?error=invalid_region", request.url));
  }

  const expertiseTags = Array.from(
    new Set(expertiseTagValues.filter((v): v is string => typeof v === "string" && v.trim() !== "")),
  );
  if (expertiseTags.some((tag) => !isAllowedControlledValue(tag, allowedExpertise, previousExpertiseTags))) {
    return NextResponse.redirect(new URL("/my/profile?error=invalid_expertise_tag", request.url));
  }

  const contact = typeof contactRaw === "string" && contactRaw.trim() ? contactRaw.trim() : null;

  // 이름이 바뀌면 검색·이력 보존을 위해 옛 이름을 previousNames에 남긴다(v0.1 P01
  // "별칭·이전 이름: 검색용, 변경 이력 보존").
  const previousNames =
    subject.name !== name && subject.name && !subject.previousNames.includes(subject.name)
      ? [...subject.previousNames, subject.name]
      : subject.previousNames;

  const contactInfo = contact ? { value: contact } : null;
  const contactConsent = { promotionalOptIn, updatedAt: new Date().toISOString() };

  // 본인이 직접 정보를 확인·수정했다는 사실 자체가 v0.1 P01의 "확인일"이다.
  // 최초 가입 시 확인 대기(NEEDS_CONFIRMATION)였던 주체는 이 시점에 활성으로 바뀐다 —
  // 그 외 상태(휴면·종료 등)는 조직이 관리하는 값이라 그대로 둔다.
  const status = subject.status === "NEEDS_CONFIRMATION" ? "ACTIVE" : subject.status;

  await prisma.$transaction(async (tx) => {
    await tx.subject.update({
      where: { id: subjectId },
      data: {
        name,
        previousNames,
        region,
        expertiseTags,
        contactInfo: contactInfo ?? Prisma.JsonNull,
        contactConsent,
        status,
        confirmedAt: new Date(),
        updatedBy: active.account.id,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Subject",
        entityId: subjectId,
        action: "UPDATE",
        actorAccountId: active.account.id,
        beforeData: {
          name: subject.name,
          region: subject.region,
          expertiseTags: subject.expertiseTags,
          contactInfo: subject.contactInfo ?? null,
          contactConsent: subject.contactConsent ?? null,
        },
        afterData: { name, region, expertiseTags, contactInfo, contactConsent },
      },
    });
  });

  return NextResponse.redirect(new URL("/my/profile", request.url));
}
