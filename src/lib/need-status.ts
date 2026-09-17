import type { NeedStatus } from "@prisma/client";

// v0.1 §3.1 필요·기회 상태전이표를 그대로 코드화한다.
// 확인중→보류는 다이어그램에 없다(제안중에서만 보류로 빠진다) — 표의 "진행→보류"는
// 다이어그램 기준으로 제안중만을 뜻하는 것으로 해석했다.
export type NeedTransitionAction = "review" | "propose" | "convert" | "hold" | "resume" | "close";

interface NeedTransitionRule {
  from: NeedStatus[];
  to: NeedStatus;
  reasonRequired: boolean;
}

export const NEED_TRANSITIONS: Record<NeedTransitionAction, NeedTransitionRule> = {
  review: { from: ["RECEIVED"], to: "REVIEWING", reasonRequired: false },
  propose: { from: ["REVIEWING"], to: "PROPOSING", reasonRequired: false },
  convert: { from: ["PROPOSING"], to: "CONVERTED", reasonRequired: false },
  hold: { from: ["PROPOSING"], to: "ON_HOLD", reasonRequired: true },
  resume: { from: ["ON_HOLD"], to: "REVIEWING", reasonRequired: false },
  close: { from: ["REVIEWING", "PROPOSING", "ON_HOLD"], to: "CLOSED", reasonRequired: true },
};

export const NEED_TRANSITION_LABELS: Record<NeedTransitionAction, string> = {
  review: "확인 시작",
  propose: "제안으로 전환",
  convert: "사업화",
  hold: "보류",
  resume: "재개",
  close: "종결",
};

export function availableNeedTransitions(status: NeedStatus): NeedTransitionAction[] {
  return (Object.keys(NEED_TRANSITIONS) as NeedTransitionAction[]).filter((action) =>
    NEED_TRANSITIONS[action].from.includes(status),
  );
}
