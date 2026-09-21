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
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>{frCode}</p>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>{title}</h1>
      <div className="card" style={{ marginTop: 12 }}>
        <p style={{ color: "var(--color-text-muted)", margin: 0 }}>{description}</p>
        <p style={{ fontSize: 12, color: "var(--color-text-faint)", marginBottom: 0 }}>
          아직 구현되지 않은 화면입니다.
        </p>
      </div>
    </section>
  );
}
