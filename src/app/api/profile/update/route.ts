import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

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
  const expertiseTagsRaw = formData.get("expertiseTags");
  const contactRaw = formData.get("contact");
  const promotionalOptIn = formData.get("promotionalOptIn") === "on";

  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    return NextResponse.redirect(new URL("/my/profile?error=invalid", request.url));
  }
  const name = nameRaw.trim();

  const region = typeof regionRaw === "string" && regionRaw.trim() ? regionRaw.trim() : null;
  const expertiseTags =
    typeof expertiseTagsRaw === "string"
      ? Array.from(new Set(expertiseTagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)))
      : [];
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
