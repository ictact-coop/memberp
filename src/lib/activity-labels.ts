import type { ActivityManagementType, ActivityStatus, Mission, Visibility } from "@prisma/client";

export const MANAGEMENT_TYPE_LABELS: Record<ActivityManagementType, string> = {
  BUSINESS: "사업",
  ORG_ACTIVITY: "조직활동",
};

// 3대 미션 (업무지도 §2.1)
export const MISSION_LABELS: Record<Mission, string> = {
  CONSUMER_GROWTH: "소비자의 성장",
  PRODUCER_SUSTAINABILITY: "생산자의 즐거움·지속가능성",
  SHARED_RESOURCE_EXPANSION: "공유 자원 확대",
};

// 공통 필드 visibility: 공개검토대기/조합원/담당팀/제한 (v0.1 §2.1)
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  PENDING_REVIEW: "공개 검토 대기",
  MEMBER: "조합원 공개",
  TEAM: "담당팀만",
  RESTRICTED: "제한",
};

// 기획/승인대기/준비/진행/수행완료/종료/보류/취소 (v0.1 §3.2)
export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  PLANNING: "기획",
  PENDING_APPROVAL: "승인대기",
  PREPARING: "준비",
  IN_PROGRESS: "진행",
  COMPLETED: "수행완료",
  CLOSED: "종료",
  ON_HOLD: "보류",
  CANCELLED: "취소",
};
