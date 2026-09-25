import type { AccountStatus } from "@prisma/client";

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  PENDING: "대기",
  ACTIVE: "활성",
  SUSPENDED: "정지됨",
  WITHDRAWN: "탈퇴함",
};

export const ACCOUNT_STATUS_BADGE_TONE: Record<AccountStatus, string> = {
  PENDING: "badge-gray",
  ACTIVE: "badge-green",
  SUSPENDED: "badge-red",
  WITHDRAWN: "badge-gray",
};

// FR-01 계정 상태 관리. 활동·상담 상태표(activity-status.ts, need-status.ts)와
// 같은 방식으로 표 하나에 "어느 상태에서 가능한지"·"사유가 필수인지"를 선언한다.
// PENDING→ACTIVE(activate)는 지금 이 앱에서 실제로 PENDING 계정이 생기는 경로가
// 없어(초대 수락 시 항상 ACTIVE로 바로 만든다) 사실상 쓰이지 않지만, 스키마의
// 기본값(@default(PENDING))과 일치시켜 두어 나중에 그런 계정이 생기더라도
// 화면에서 처리할 수 있게 해둔다.
export type AccountStatusAction = "activate" | "suspend" | "reactivate" | "withdraw" | "rejoin";

interface AccountStatusRule {
  from: AccountStatus[];
  to: AccountStatus;
  reasonRequired: boolean;
}

export const ACCOUNT_STATUS_TRANSITIONS: Record<AccountStatusAction, AccountStatusRule> = {
  activate: { from: ["PENDING"], to: "ACTIVE", reasonRequired: false },
  suspend: { from: ["ACTIVE"], to: "SUSPENDED", reasonRequired: true },
  reactivate: { from: ["SUSPENDED"], to: "ACTIVE", reasonRequired: false },
  withdraw: { from: ["ACTIVE", "SUSPENDED"], to: "WITHDRAWN", reasonRequired: true },
  rejoin: { from: ["WITHDRAWN"], to: "ACTIVE", reasonRequired: false },
};

export const ACCOUNT_STATUS_ACTION_LABELS: Record<AccountStatusAction, string> = {
  activate: "활성화",
  suspend: "정지",
  reactivate: "재활성화",
  withdraw: "탈퇴 처리",
  rejoin: "재가입 처리",
};

export function availableAccountStatusActions(status: AccountStatus): AccountStatusAction[] {
  return (Object.keys(ACCOUNT_STATUS_TRANSITIONS) as AccountStatusAction[]).filter((action) =>
    ACCOUNT_STATUS_TRANSITIONS[action].from.includes(status),
  );
}
