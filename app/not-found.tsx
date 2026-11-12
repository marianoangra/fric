import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap narrow" style={{ padding: "64px 16px" }}>
      <h1 style={{ fontSize: 40 }}>Não achamos essa página</h1>
      <p>
        <Link href="/">Voltar para o início</Link>
      </p>
    </main>
  );
}
