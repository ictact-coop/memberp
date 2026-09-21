import type { Prisma } from "@prisma/client";

// 지역·전문영역 분류 체계. `Classification`은 (domain, code, label) 조회표로
// R1 스키마 설계 때부터 있었지만 아무 화면도 쓰지 않았다(활동 서비스 분류 등
// 다른 domain은 이번 범위 밖 — 필요해지면 이 배열에 추가하면 된다). 지금은
// 내 정보·기구의 지역·전문영역/관심 두 필드만 자유 텍스트에서 이 표 기반
// 선택형으로 옮긴다.
export const CLASSIFICATION_DOMAINS = ["REGION", "EXPERTISE"] as const;
export type ClassificationDomain = (typeof CLASSIFICATION_DOMAINS)[number];

export const CLASSIFICATION_DOMAIN_LABELS: Record<ClassificationDomain, string> = {
  REGION: "지역",
  EXPERTISE: "전문영역·관심",
};

export function isClassificationDomain(value: string): value is ClassificationDomain {
  return (CLASSIFICATION_DOMAINS as readonly string[]).includes(value);
}

// 코드는 사람이 타이핑한 값을 그대로 유일 제약(domain, code)에 넣지 않고
// 정규화한다 — 대소문자나 공백 차이로 "seoul"과 "SEOUL"이 따로 생기는 것을
// 막는다. 화면에 보여줄 때는 항상 label을 쓰므로 code 자체의 표기는 중요하지
// 않다.
export function normalizeClassificationCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

// 지역·전문영역 라벨을 고치거나 두 항목을 합칠 때, 그 라벨을 이미 값으로 갖고
// 있는 Subject.region/expertiseTags까지 함께 옮긴다. 이 두 필드는 Classification.id가
// 아니라 label 문자열을 그대로 복사해 저장하므로("controlled-vocabulary +
// 레거시 자유 텍스트" 설계 — 위 isAllowedControlledValue 참고), FK 기반
// 병합(src/lib/subject-merge.ts)과 달리 값 일치로 찾아 바꿔야 한다.
export async function relabelSubjectsForClassification(
  tx: Prisma.TransactionClient,
  domain: ClassificationDomain,
  oldLabel: string,
  newLabel: string,
): Promise<number> {
  if (oldLabel === newLabel) return 0;

  if (domain === "REGION") {
    const result = await tx.subject.updateMany({
      where: { region: oldLabel },
      data: { region: newLabel },
    });
    return result.count;
  }

  // EXPERTISE는 배열 필드라 updateMany로 원소 하나만 바꿀 수 없어 건별로 고친다.
  const subjects = await tx.subject.findMany({
    where: { expertiseTags: { has: oldLabel } },
    select: { id: true, expertiseTags: true },
  });
  for (const subject of subjects) {
    const nextTags = Array.from(
      new Set(subject.expertiseTags.map((tag) => (tag === oldLabel ? newLabel : tag))),
    );
    await tx.subject.update({ where: { id: subject.id }, data: { expertiseTags: nextTags } });
  }
  return subjects.length;
}

// 지역·전문영역처럼 "정식 분류표 + 이미 저장된 자유 텍스트"가 함께 있는 필드를
// 선택형으로 옮기되 기존 값을 잃지 않기 위한 규칙: 제출된 값은 (a) 현재 활성인
// 분류표 라벨이거나 (b) 그 항목이 원래 갖고 있던 값(레거시 자유 텍스트)이어야
// 한다. 화면은 (b)를 "(목록에 없음)"이라고 표시한 채 체크박스/선택지로 계속
// 보여줘서, 분류표가 아직 못 따라간 기존 값도 조용히 사라지지 않게 한다.
export function isAllowedControlledValue(
  value: string,
  allowedLabels: ReadonlySet<string>,
  previousValues: ReadonlySet<string>,
): boolean {
  return allowedLabels.has(value) || previousValues.has(value);
}
