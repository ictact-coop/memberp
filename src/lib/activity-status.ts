import type { ActivityStatus } from "@prisma/client";

// v0.1 §3.2 활동 상태 전이표를 그대로 코드화한다.
// 기획→승인대기→준비→진행→수행완료→종료가 정상 경로이고, 보류·취소는
// "진행 중인" 상태(ACTIVE)에서 곁가지로 빠지는 예외 경로다.
export const ACTIVITY_ACTIVE_STATUSES: ActivityStatus[] = [
  "PLANNING",
  "PENDING_APPROVAL",
  "PREPARING",
  "IN_PROGRESS",
];

export type ActivityTransitionAction =
  | "request_approval"
  | "approve"
  | "reject"
  | "start"
  | "complete"
  | "close"
  | "hold"
  | "resume"
  | "cancel";

interface ActivityTransitionRule {
  from: ActivityStatus[];
  // "RESUME"은 고정된 다음 상태가 아니라 보류 직전 상태로 돌아간다는 뜻 — 실제 목적지는
  // AuditLog에서 보류 진입 시점의 beforeData.status를 읽어 런타임에 계산한다.
  to: ActivityStatus | "RESUME";
  reasonRequired: boolean;
}

export const ACTIVITY_TRANSITIONS: Record<ActivityTransitionAction, ActivityTransitionRule> = {
  request_approval: { from: ["PLANNING"], to: "PENDING_APPROVAL", reasonRequired: false },
  approve: { from: ["PENDING_APPROVAL"], to: "PREPARING", reasonRequired: false },
  reject: { from: ["PENDING_APPROVAL"], to: "PLANNING", reasonRequired: true },
  start: { from: ["PREPARING"], to: "IN_PROGRESS", reasonRequired: false },
  complete: { from: ["IN_PROGRESS"], to: "COMPLETED", reasonRequired: false },
  close: { from: ["COMPLETED"], to: "CLOSED", reasonRequired: true },
  hold: { from: ACTIVITY_ACTIVE_STATUSES, to: "ON_HOLD", reasonRequired: true },
  resume: { from: ["ON_HOLD"], to: "RESUME", reasonRequired: false },
  cancel: { from: [...ACTIVITY_ACTIVE_STATUSES, "ON_HOLD"], to: "CANCELLED", reasonRequired: true },
};

export const ACTIVITY_TRANSITION_LABELS: Record<ActivityTransitionAction, string> = {
  request_approval: "승인 요청",
  approve: "승인",
  reject: "반려 (기획으로 되돌리기)",
  start: "진행 시작",
  complete: "수행완료 처리",
  close: "종료",
  hold: "보류",
  resume: "재개",
  cancel: "취소",
};

// close(종료)만 사유가 곧 평가 메모(Activity.closeEvaluationNote)로 남는다 — 그 외
// reasonRequired 전이는 AuditLog.reason에만 남는다.
export const ACTIVITY_TRANSITION_REASON_LABELS: Partial<Record<ActivityTransitionAction, string>> = {
  reject: "보완 사유",
  close: "종료 평가",
  hold: "보류 사유",
  cancel: "취소 사유",
};

export function availableActivityTransitions(status: ActivityStatus): ActivityTransitionAction[] {
  return (Object.keys(ACTIVITY_TRANSITIONS) as ActivityTransitionAction[]).filter((action) =>
    ACTIVITY_TRANSITIONS[action].from.includes(status),
  );
}
