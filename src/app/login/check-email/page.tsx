export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>메일을 확인하세요</h1>
      <p style={{ color: "#555555" }}>
        {email ? `${email}로 ` : ""}로그인 링크를 보냈습니다. 15분 안에 메일함(스팸함 포함)에서
        링크를 눌러주세요.
      </p>
      <p style={{ fontSize: 12, color: "#aaaaaa" }}>
        메일이 오지 않으면 <a href="/login">다시 요청</a>하세요.
      </p>
    </section>
  );
}
