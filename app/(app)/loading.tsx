export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="colhead"><div className="bar"><div className="sk" style={{ width: 120, height: 20 }} /></div></div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="post" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
          <div className="sk" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <div style={{ display: "grid", gap: 8 }}>
            <div className="sk" style={{ width: "40%", height: 14 }} />
            <div className="sk" style={{ width: "95%", height: 14 }} />
            <div className="sk" style={{ width: "70%", height: 14 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
