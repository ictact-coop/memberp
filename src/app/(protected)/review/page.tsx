import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

// 담당자 확인함 — FR-07. 활동별 제출 목록, 일괄 조회, 개별 확인·보완.
// 활동 책임자·분야 운영자 권한이 있는 계정만 접근해야 한다(권한 검사는 아직 미구현).
export default function ReviewInboxPage() {
  return (
    <ScreenPlaceholder
      title="담당자 확인함"
      frCode="FR-07"
      description="담당 활동별로 제출된 기여를 확인·보완요청하는 화면입니다."
    />
  );
}
