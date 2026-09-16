type ScreenPlaceholderProps = {
  title: string;
  frCode: string;
  description: string;
};

// 화면 로직이 아직 구현되지 않은 R1 라우트의 자리표시자.
// FR 번호를 그대로 노출해 기획서 v1.0 §5 요구사항 번호와 화면을 맞춰볼 수 있게 한다.
export function ScreenPlaceholder({ title, frCode, description }: ScreenPlaceholderProps) {
  return (
    <section>
      <p style={{ fontSize: 12, color: "#888888", marginBottom: 4 }}>{frCode}</p>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>{title}</h1>
      <p style={{ color: "#555555" }}>{description}</p>
      <p style={{ fontSize: 12, color: "#aaaaaa" }}>아직 구현되지 않은 화면입니다.</p>
    </section>
  );
}
