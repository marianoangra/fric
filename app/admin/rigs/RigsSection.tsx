import { FileText, Pause, Play, RotateCcw } from "lucide-react";
import { listarRigs, type RigPainel } from "@/lib/rigs";
import { estaOnline } from "@/lib/rigs-core";
import { adminComandoRig, adminConfirmarRig, adminRecusarRig, adminRemoverRig } from "@/lib/admin-actions";
import { ago } from "@/lib/format";
import { AutoRefresh, BotaoReiniciarRig, NovoConvite } from "./RigsClient";

const ETAPAS = ["apt", "driver", "ollama", "modelo", "leila", "tailscale", "guardia", "testnet", "pronto"];
const NOME_ETAPA: Record<string, string> = {
  apt: "Sistema", driver: "Driver da placa", ollama: "Ollama", modelo: "Modelo (~5 GB)", leila: "Leila", tailscale: "Túnel",
  guardia: "Guardiã", testnet: "Teste testnet", pronto: "Pronto",
};
const NOME_CMD: Record<string, string> = {
  pausar: "Pausar", retomar: "Retomar", reiniciar_guardia: "Reiniciar Guardiã", reiniciar_rig: "Reiniciar rig", ver_log: "Ver log",
};
const POSTURA: Record<string, string> = { EXPOSTA: "NORMAL", ATENCAO: "ATENÇÃO", FORA: "FORA" };
const COR_TOM: Record<string, string> = { verde: "mint", laranja: "sun", vermelho: "rose" };

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const ha = (iso: string) => (ago(iso) === "agora" ? "agora mesmo" : `há ${ago(iso)}`);
const grau = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}°C`);

function Cmd({ id, tipo, children, disabled }: { id: number; tipo: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <form action={adminComandoRig}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tipo" value={tipo} />
      <button className="btn outline sm" disabled={disabled}>{children}</button>
    </form>
  );
}

function Pendente({ r }: { r: RigPainel }) {
  return (
    <article className="rig-card rig-pend">
      <div className="rig-head">
        <b>{r.nome}</b>
        <span className="pill sun">Esperando confirmação</span>
      </div>
      <p className="muted">Uma rig se registrou sem convite há {ago(r.criada_em)}. É sua?</p>
      <div className="rig-codigo">{r.codigo}</div>
      <div className="row-g">
        <form action={adminConfirmarRig}><input type="hidden" name="id" value={r.id} /><button className="btn brand sm">Confirmar</button></form>
        <form action={adminRecusarRig}><input type="hidden" name="id" value={r.id} /><button className="btn soft sm">Recusar</button></form>
      </div>
    </article>
  );
}

function Instalacao({ i }: { i: NonNullable<NonNullable<RigPainel["ultimo_status"]>["instalacao"]> }) {
  const atual = ETAPAS.indexOf(i.etapa);
  return (
    <div className="rig-inst">
      <span className="rig-lbl">Instalação</span>
      <ol className="rig-etapas">
        {ETAPAS.map((e, k) => {
          const st = k < atual || (e === i.etapa && i.ok) ? "ok" : e === i.etapa ? (i.ok === false ? "erro" : "agora") : "";
          return <li key={e} className={st}>{NOME_ETAPA[e]}</li>;
        })}
      </ol>
      {i.erro && <p className="rig-erro">Parou em {NOME_ETAPA[i.etapa] ?? i.etapa}: {i.erro}</p>}
      {i.saida && <pre className="rig-pre">{i.saida}</pre>}
    </div>
  );
}

function Ativa({ r }: { r: RigPainel }) {
  const s = r.ultimo_status;
  const online = estaOnline(r.visto_em ? new Date(r.visto_em) : null, new Date());
  const g = s?.guardia;
  const leila = s?.ollama.modelos_carregados ?? [];
  const naGpu = leila.some((m) => (m.vram_mb ?? 0) > 0);
  const esperando = r.em_andamento.map((c) => NOME_CMD[c.tipo] ?? c.tipo);
  return (
    <article className={`rig-card ${online ? "" : "off"}`}>
      <div className="rig-head">
        <b><span className={`dot ${online ? "mint" : "rose"}`} aria-hidden /> {r.nome}</b>
        <span className="muted">
          {online ? `online há ${ago(new Date(Date.now() - (s?.uptime_s ?? 0) * 1000).toISOString())}` : r.visto_em ? `offline · visto há ${ago(r.visto_em)}` : "nunca falou"}
        </span>
      </div>

      {s && (
        <dl className="rig-dados">
          <div><dt>GPU</dt><dd>{s.gpu ? `${grau(s.gpu.temp_c)} · ${s.gpu.uso_pct ?? "—"}%` : "sem leitura"}</dd></div>
          <div><dt>CPU</dt><dd>{grau(s.cpu.temp_c)} · carga {s.cpu.carga_1m ?? "—"}</dd></div>
          <div><dt>Ollama</dt><dd>{s.ollama.ok ? (leila.length ? (naGpu ? "ok · na placa" : "ok · só processador") : "ok") : "fora do ar"}</dd></div>
          <div><dt>Leila</dt><dd>{s.leila.gate_ok ? "ok" : "fora do ar"}</dd></div>
        </dl>
      )}

      {g ? (
        <div className="rig-guardia">
          <span className="rig-lbl">Guardiã</span>
          <p>
            <span className={`pill ${COR_TOM[g.cor ?? ""] ?? "gray"}`}>
              {g.servico !== "ativa" ? `serviço ${g.servico}` : g.pausada ? "PAUSADA" : `${POSTURA[g.postura ?? ""] ?? g.postura ?? "—"} (${pct(g.pct_protegido)})`}
            </span>{" "}
            <span className="muted">anel {g.cor ?? "—"} · margem {pct(g.margem)}{g.ts_ultimo_ciclo ? ` · ciclo ${ha(g.ts_ultimo_ciclo)}` : ""}</span>
          </p>
          {g.motivo && <p className="rig-motivo">“{g.motivo}”</p>}
        </div>
      ) : s && <p className="muted">Guardiã ainda não instalada.</p>}

      {s?.instalacao && s.instalacao.etapa !== "pronto" && <Instalacao i={s.instalacao} />}
      {s?.instalacao?.etapa === "pronto" && s.instalacao.saida && (
        <details className="rig-log"><summary>Resultado do teste na testnet</summary><pre className="rig-pre">{s.instalacao.saida}</pre></details>
      )}

      <div className="rig-acts">
        {g?.pausada
          ? <Cmd id={r.id} tipo="retomar"><Play size={15} aria-hidden /> Retomar</Cmd>
          : <Cmd id={r.id} tipo="pausar" disabled={!g}><Pause size={15} aria-hidden /> Pausar</Cmd>}
        <Cmd id={r.id} tipo="reiniciar_guardia" disabled={!g}><RotateCcw size={15} aria-hidden /> Reiniciar Guardiã</Cmd>
        <BotaoReiniciarRig id={r.id} />
        <Cmd id={r.id} tipo="ver_log"><FileText size={15} aria-hidden /> Ver log</Cmd>
      </div>
      {esperando.length > 0 && <p className="rig-espera">Aguardando a rig: {esperando.join(", ")}…</p>}
      {r.ultimo_erro && <p className="rig-erro">{NOME_CMD[r.ultimo_erro.tipo] ?? r.ultimo_erro.tipo} falhou {ha(r.ultimo_erro.concluido_em)}: {r.ultimo_erro.texto}</p>}
      {r.ultimo_log && (
        <details className="rig-log">
          <summary>Log recebido {ha(r.ultimo_log.concluido_em)}</summary>
          <pre className="rig-pre">{r.ultimo_log.texto}</pre>
        </details>
      )}
      {!online && (
        <form action={adminRemoverRig} className="rig-remover">
          <input type="hidden" name="id" value={r.id} />
          <button className="btn soft sm">Remover rig</button>
        </form>
      )}
    </article>
  );
}

export async function RigsSection() {
  const rigs = await listarRigs();
  return (
    <section className="panel">
      <AutoRefresh />
      <div className="rig-top">
        <h2>Minhas rigs <small>atualiza sozinho a cada 15 s</small></h2>
        <NovoConvite />
      </div>
      {rigs.length === 0 ? (
        <p className="muted">Nenhuma rig ainda. Gere um convite em “Nova rig” e coloque no pendrive.</p>
      ) : (
        <div className="rig-grid">
          {rigs.map((r) => (r.estado === "pendente" ? <Pendente key={r.id} r={r} /> : <Ativa key={r.id} r={r} />))}
        </div>
      )}
    </section>
  );
}
