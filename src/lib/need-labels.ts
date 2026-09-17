import type { NeedChannel, NeedCloseType, NeedStatus } from "@prisma/client";

export const NEED_CHANNEL_LABELS: Record<NeedChannel, string> = {
  PHONE: "전화",
  EMAIL: "이메일",
  REFERRAL: "소개",
  EVENT: "행사",
  SELF_DISCOVERED: "자체 발견",
  PUBLIC_CALL: "공개 모집",
};

// 접수/확인중/제안중/사업화/보류/종결 (v0.1 §3.1)
export const NEED_STATUS_LABELS: Record<NeedStatus, string> = {
  RECEIVED: "접수",
  REVIEWING: "확인중",
  PROPOSING: "제안중",
  CONVERTED: "사업화",
  ON_HOLD: "보류",
  CLOSED: "종결",
};

export const NEED_CLOSE_TYPE_LABELS: Record<NeedCloseType, string> = {
  SELF_RESOLVED: "자체 해결",
  REFERRED_ELSEWHERE: "타 기관 연계",
  NOT_PROGRESSED: "진행 안 됨",
  WITHDRAWN: "철회",
  CONVERTED_TO_ACTIVITY: "사업화됨",
};
