import type { NotificationType } from "@prisma/client";

// FR-10 "보완요청·확인결과·배정변경을 앱 안에서 확인". NotificationType은
// R1 스키마 설계 때부터 있었지만 이번에 처음 실제로 만든다.
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  REVISION_REQUESTED: "보완 요청",
  CONTRIBUTION_CONFIRMED: "기여 확인됨",
  ASSIGNMENT_CHANGED: "참여 배정 변경",
  NEED_ASSIGNED: "상담·수요 배정",
  GENERIC: "알림",
};
