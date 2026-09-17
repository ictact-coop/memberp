import type { AssignmentStatus } from "@prisma/client";

// 제안/수락/진행/종료/취소 (v0.1 A05)
export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PROPOSED: "신청함 · 승인 대기",
  ACCEPTED: "수락됨",
  IN_PROGRESS: "진행 중",
  ENDED: "종료됨",
  CANCELLED: "취소됨",
};

// v0.1 A05가 예시로 든 배정 역할. 자유 문자열 필드라 목록에 없는 값도 저장될 수 있다.
export const ASSIGNMENT_ROLE_OPTIONS = [
  "책임",
  "개발",
  "강의",
  "보조",
  "운영",
  "기록",
  "자문",
] as const;

// 신청을 다시 받을 수 있는 상태 — 취소·종료된 뒤에는 새로 신청할 수 있다.
export const REOPENABLE_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["CANCELLED", "ENDED"];
