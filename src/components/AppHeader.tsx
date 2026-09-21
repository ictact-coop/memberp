// 공동체IT 운영허브 디자인 컨셉의 로고 배지(라임 사각형 "IT" + 워드마크)를
// 모바일 상단바 형태로 옮긴 것. 기능은 없고 브랜드 정체성만 준다.
export function AppHeader() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0 16px",
      }}
    >
      <span className="brand-mark">IT</span>
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>공동체IT</div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>운영허브</div>
      </div>
    </header>
  );
}
