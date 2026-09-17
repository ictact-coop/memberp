import type { CompensationBasis, ContributionStatus, ContributionType } from "@prisma/client";

// v0.1 §5.4 여덟 가지 기여 유형
export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  TIME: "시간",
  EXPERTISE: "전문역량",
  EXECUTION: "실행",
  RELATIONSHIP: "관계",
  RESOURCE: "자원",
  KNOWLEDGE: "지식",
  GOVERNANCE: "거버넌스",
  CARE: "돌봄·유지",
};

export const COMPENSATION_BASIS_LABELS: Record<CompensationBasis, string> = {
  PAID: "유급",
  UNPAID_CONSENT: "무급(동의)",
  MIXED_NEEDS_SPLIT: "혼합(분리 필요)",
  UNCONFIRMED: "미확인",
};

export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = {
  DRAFT: "임시저장",
  SUBMITTED: "제출됨 · 확인 대기",
  NEEDS_REVISION: "보완 요청됨",
  CONFIRMED: "확인됨",
  SUPERSEDED: "이전 버전(새 버전으로 대체됨)",
  CANCELLED: "취소됨",
};
