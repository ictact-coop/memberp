import type { SubjectStatus } from "@prisma/client";

// v0.1 P01: 활동 상태(활성/휴면/종료/확인필요)는 조합원 자격과는 별개다.
export const SUBJECT_STATUS_LABELS: Record<SubjectStatus, string> = {
  ACTIVE: "활성",
  DORMANT: "휴면",
  CLOSED: "종료",
  NEEDS_CONFIRMATION: "확인 필요",
};
