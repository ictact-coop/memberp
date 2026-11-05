import type { Prisma } from "@prisma/client";

// 지역·전문영역·활동 서비스 분류 체계. `Classification`은 (domain, code, label)
// 조회표로 R1 스키마 설계 때부터 있었지만 처음엔 아무 화면도 쓰지 않았다.
// ACTIVITY_SERVICE는 `ActivityClassification`(활동 ↔ 분류, 진짜 외래키 기반
// N:M)이 이미 예정해 둔 도메인을 채운 것이다 — "분류 관리·병합" 화면 절 참고.
export const CLASSIFICATION_DOMAINS = ["REGION", "EXPERTISE", "ACTIVITY_SERVICE"] as const;
export type ClassificationDomain = (typeof CLASSIFICATION_DOMAINS)[number];

export const CLASSIFICATION_DOMAIN_LABELS: Record<ClassificationDomain, string> = {
  REGION: "지역",
  EXPERTISE: "전문영역·관심",
  ACTIVITY_SERVICE: "활동 서비스 분류",
};

export function isClassificationDomain(value: string): value is ClassificationDomain {
  return (CLASSIFICATION_DOMAINS as readonly string[]).includes(value);
}

// REGION·EXPERTISE만 Subject.region/expertiseTags에 라벨 문자열을 그대로 복사해
// 저장한다(레거시 자유 텍스트와 공존시키는 설계, 아래 relabelSubjectsForClassification
// 참고). ACTIVITY_SERVICE는 ActivityClassification.classificationId라는 진짜
// 외래키로만 연결되어 라벨 문자열을 어디에도 복사해 두지 않으므로, 라벨을 바꾸거나
// 병합해도 이 재라벨링이 전혀 필요 없다 — 두 그룹을 타입으로 갈라 뒀다(새 domain을
// 추가할 때 여기 넣는 걸 깜빡해도 조용히 엉뚱한 필드를 뒤지는 대신 타입 에러가 난다).
export const SUBJECT_LABEL_DOMAINS = ["REGION", "EXPERTISE"] as const;
export type SubjectLabelDomain = (typeof SUBJECT_LABEL_DOMAINS)[number];

export function isSubjectLabelDomain(value: string): value is SubjectLabelDomain {
  return (SUBJECT_LABEL_DOMAINS as readonly string[]).includes(value);
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
  domain: SubjectLabelDomain,
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
