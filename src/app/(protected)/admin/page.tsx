import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

// 관리자 설정 — 역할, 코드, 정책, 감사기록, 백업 상태.
// 시스템 관리자 권한 전용 화면이며, R1 범위에서는 초대·계정 상태 관리 정도만 우선 구현한다.
export default function AdminPage() {
  return (
    <ScreenPlaceholder
      title="관리자 설정"
      frCode="FR-01, FR-11"
      description="초대·계정 상태, 권한, 감사기록, 백업 상태를 관리하는 화면입니다."
    />
  );
}
