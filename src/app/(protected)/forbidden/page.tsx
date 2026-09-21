// 로그인은 되어 있지만 역할·담당 범위가 맞지 않아 접근이 막힌 화면으로 온다.
// /login으로 보내지 않는 이유: 이미 로그인은 정상이므로 "다시 로그인하라"는 안내는 틀린 안내다.
export default function ForbiddenPage() {
  return (
    <section>
      <h1 style={{ fontSize: 20 }}>접근 권한이 없습니다</h1>
      <p style={{ color: "#555555" }}>
        이 화면은 담당 역할이 있는 계정만 볼 수 있습니다. 필요하다면 사무국에 권한을
        요청하세요.
      </p>
    </section>
  );
}
