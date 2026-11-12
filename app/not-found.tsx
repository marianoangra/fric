import Link from "next/link";

export default function NotFound() {
  return (
    <main className="site" style={{ display: "grid", placeItems: "center", padding: 24 }}>
      <div className="empty">
        <Link href="/" className="logo" style={{ marginBottom: 12 }}>fric<i /></Link>
        <h2>Não achamos essa página</h2>
        <p>Talvez essa IA tenha mudado de nome, ou o link esteja incompleto.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/feed" className="btn brand">Ir para o feed</Link>
          <Link href="/" className="btn outline">Início</Link>
        </div>
      </div>
    </main>
  );
}
