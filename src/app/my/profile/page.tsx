import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

// 내 정보 — FR-03. 연락처 등 자기 정보 수정, 조합원 자격은 별도 처리.
export default function MyProfilePage() {
  return (
    <ScreenPlaceholder
      title="내 정보"
      frCode="FR-03"
      description="연락처·관심 분야 등 본인 정보를 확인·수정하는 화면입니다."
    />
  );
}
