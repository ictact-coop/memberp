-- AlterTable
ALTER TABLE "contributions" ALTER COLUMN "description" DROP NOT NULL;


-- 이전 제약(정확히 하나)은 BR-01 "임시저장에는 활동이 없어도 된다"와 충돌해 수정한다.
-- 활동과 필요 양쪽에 동시에 걸치는 경우만 막고, "제출 시점부터는 하나가 필요하다"는
-- 애플리케이션에서 검증한다.
ALTER TABLE "contributions" DROP CONSTRAINT "contributions_activity_or_need_xor";

ALTER TABLE "contributions"
  ADD CONSTRAINT "contributions_activity_or_need_not_both"
  CHECK (NOT ("activityId" IS NOT NULL AND "needId" IS NOT NULL));
