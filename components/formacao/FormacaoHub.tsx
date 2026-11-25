"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { BookOpen, CheckCircle2, ExternalLink, Gift, GraduationCap, Rocket, Store, Trophy, Zap } from "lucide-react";
import { MODULOS, type Modulo } from "@/lib/formacao-conteudo";
import { FormacaoPage as MateriaisEmpresa } from "@/components/formacao/FormacaoPage";
import { authFetch, authFetcher } from "@/lib/client/authFetch";

type Aba = "comecar" | "metodo" | "mypoupar" | "operadora" | "natal" | "materiais";
type Campanha = { id: string; title: string; description: string | null; operator: string | null; service_type: string | null; published_at: string | null };

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const ABAS: { id: Aba; label: string; icon: React.ReactNode }[] = [
  { id: "comecar", label: "Começa aqui", icon: <Rocket size={15} /> },
  { id: "metodo", label: "Método AEDCRAFAM", icon: <GraduationCap size={15} /> },
  { id: "mypoupar", label: "MyPoupar+", icon: <Store size={15} /> },
  { id: "operadora", label: "Por operadora", icon: <Zap size={15} /> },
  { id: "natal", label: "Natal", icon: <Gift size={15} /> },
  { id: "materiais", label: "Materiais da empresa", icon: <BookOpen size={15} /> },
];

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 18, marginBottom: 14 };

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function Quiz({ modulo, feito, onPassou }: { modulo: Modulo; feito: boolean; onPassou: () => Promise<void> }) {
  const [resp, setResp] = useState<Record<number, number>>({});
  const [verificado, setVerificado] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const certas = modulo.quiz.filter((q, i) => resp[i] === q.certa).length;
  const tudo = Object.keys(resp).length === modulo.quiz.length;
  const passou = verificado && certas === modulo.quiz.length;

  async function verificar() {
    setVerificado(true);
    if (certas === modulo.quiz.length && !feito) {
      setAGuardar(true);
      await onPassou();
      setAGuardar(false);
    }
  }

  return (
    <div style={{ ...card, background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ fontWeight: 800, color: "#0F172A" }}>Teste rápido</div>
        {feito ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "#15803D" }}>
            <CheckCircle2 size={15} /> Concluído
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: "#64748B" }}>Acerta tudo para concluir o módulo</span>
        )}
      </div>
      {modulo.quiz.map((q, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>{q.pergunta}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {q.opcoes.map((o, j) => {
              const escolhida = resp[i] === j;
              const cor = verificado && escolhida ? (j === q.certa ? "#16A34A" : "#DC2626") : escolhida ? "#2563EB" : "#E2E8F0";
              return (
                <button key={j} type="button" onClick={() => { setResp({ ...resp, [i]: j }); setVerificado(false); }}
                  style={{ textAlign: "left", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${cor}`, background: escolhida ? "#fff" : "#fff", fontSize: 13.5, cursor: "pointer", color: "#0F172A" }}>
                  {o}
                </button>
              );
            })}
          </div>
          {verificado && resp[i] !== undefined && (
            <div style={{ fontSize: 12.5, marginTop: 5, color: resp[i] === q.certa ? "#15803D" : "#B91C1C" }}>
              {resp[i] === q.certa ? "Certo. " : "Ainda não. "}{q.porque}
            </div>
          )}
        </div>
      ))}
      <button type="button" disabled={!tudo || aGuardar} onClick={verificar}
        style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: tudo ? "#2563EB" : "#CBD5E1", color: "#fff", fontWeight: 800, cursor: tudo ? "pointer" : "default" }}>
        {aGuardar ? "A guardar…" : "Verificar respostas"}
      </button>
      {passou && !feito && !aGuardar && <span style={{ marginLeft: 10, fontSize: 13, color: "#15803D", fontWeight: 700 }}>Boa! Módulo concluído 🎉</span>}
    </div>
  );
}

function ModuloView({ modulo, feito, onPassou, extra }: { modulo: Modulo; feito: boolean; onPassou: () => Promise<void>; extra?: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...card, background: "linear-gradient(135deg,#EFF6FF,#F5F3FF)", borderColor: "#DBEAFE" }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: "#0F172A" }}>{modulo.titulo}</div>
        <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>{modulo.resumo}</div>
      </div>
      {extra}
      {modulo.seccoes.map((s, i) => (
        <div key={i} style={card}>
          <div style={{ fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>{s.titulo}</div>
          {s.texto && <p style={{ margin: "0 0 8px", fontSize: 14, color: "#334155", lineHeight: 1.55 }}>{s.texto}</p>}
          {s.guiao && (
            <div style={{ display: "grid", gap: 6, marginBottom: 6 }}>
              {s.guiao.map((g, j) => (
                <div key={j} style={{ fontSize: 14, color: "#1E3A8A", background: "#EFF6FF", borderLeft: "3px solid #3B82F6", padding: "8px 10px", borderRadius: 8 }}>{g}</div>
              ))}
            </div>
          )}
          {s.pontos && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
              {s.pontos.map((p, j) => <li key={j}>{p}</li>)}
            </ul>
          )}
          {s.aviso && <div style={{ marginTop: 8, fontSize: 13, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "7px 10px", borderRadius: 8 }}>⚠️ {s.aviso}</div>}
        </div>
      ))}
      <Quiz modulo={modulo} feito={feito} onPassou={onPassou} />
    </div>
  );
}

function CampanhasDaOperadora({ operadora, tipo }: { operadora: string; tipo?: string }) {
  const { data, isLoading } = useSWR<{ campanhas: Campanha[] }>("/api/campanhas-operadoras", fetcher);
  const alvo = normalizar(operadora);
  const lista = (data?.campanhas || []).filter((c) => {
    const op = normalizar(String(c.operator || ""));
    if (!op) return false;
    if (alvo === "meo energia") return op.includes("meo") && (c.service_type === "energia" || op.includes("energia"));
    if (alvo === "meo") return op.includes("meo") && c.service_type !== "energia" && !op.includes("energia");
    return op.includes(alvo) || alvo.includes(op);
  });
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontWeight: 800, color: "#0F172A" }}>Campanhas ativas — {operadora}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(tipo === "energia" || tipo === "solar") && (
            <Link href="/simulador-energia" style={{ fontSize: 13, fontWeight: 700, color: "#0F766E" }}>⚡ Simulador</Link>
          )}
          <Link href="/campanhas-operadoras" style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5" }}>Ver todas →</Link>
        </div>
      </div>
      {isLoading && <div style={{ fontSize: 13, color: "#64748B" }}>A carregar…</div>}
      {!isLoading && lista.length === 0 && (
        <div style={{ fontSize: 13, color: "#64748B" }}>Sem campanhas ativas desta operadora neste momento. Confirma com o teu supervisor antes de dizer preços.</div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {lista.map((c) => (
          <div key={c.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</div>
            {c.description && <div style={{ fontSize: 13, color: "#475569", whiteSpace: "pre-wrap", marginTop: 4 }}>{c.description}</div>}
            {c.published_at && <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 4 }}>Publicada a {new Date(c.published_at).toLocaleDateString("pt-PT")}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MyPouparEmbed() {
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 800, color: "#0F172A" }}>O site, tal como o cliente o vê</div>
        <a href="https://mypoupar.pt" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#2563EB" }}>
          Abrir mypoupar.pt <ExternalLink size={13} />
        </a>
      </div>
      <iframe src="https://mypoupar.pt" title="MyPoupar+" style={{ width: "100%", height: 560, border: "1px solid #E2E8F0", borderRadius: 12 }} />
    </div>
  );
}

export function FormacaoHub() {
  const [aba, setAba] = useState<Aba>("comecar");
  const [opId, setOpId] = useState<string>("op-meo");
  const { data, mutate } = useSWR<{ progresso: Record<string, string> }>("/api/formacao/progresso", authFetcher);
  const progresso = data?.progresso || {};
  const total = MODULOS.length;
  const feitos = MODULOS.filter((m) => progresso[m.id]).length;
  const operadoras = useMemo(() => MODULOS.filter((m) => m.grupo === "operadora"), []);

  async function passou(id: string) {
    const r = await authFetch("/api/formacao/progresso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modulo: id }) });
    if (r.ok) await mutate(await r.json(), { revalidate: false });
  }

  const modulo = (grupo: Modulo["grupo"]) => MODULOS.find((m) => m.grupo === grupo)!;
  const opAtual = operadoras.find((m) => m.id === opId) || operadoras[0];

  return (
    <div className="mx-auto min-w-0 max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A" }}>Formação</h1>
          <p style={{ margin: "5px 0 0", fontSize: 14, color: "#64748B" }}>Tudo o que precisas para ligar, comparar e fechar — método MyPoupar+.</p>
        </div>
        <Link href="/gamificacao" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 12, background: "#0F172A", color: "#fff", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
          <Trophy size={15} /> {feitos}/{total} módulos · Ranking
        </Link>
      </div>
      <div style={{ height: 8, background: "#E2E8F0", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: `${Math.round((feitos / total) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#2563EB,#7C3AED)" }} />
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14 }}>
        {ABAS.map((a) => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 999, border: `1.5px solid ${aba === a.id ? "#2563EB" : "#E2E8F0"}`, background: aba === a.id ? "#2563EB" : "#fff", color: aba === a.id ? "#fff" : "#334155", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {aba === "comecar" && <ModuloView modulo={modulo("comecar")} feito={!!progresso.comecar} onPassou={() => passou("comecar")} />}
      {aba === "metodo" && <ModuloView modulo={modulo("metodo")} feito={!!progresso["metodo-aedcrafam"]} onPassou={() => passou("metodo-aedcrafam")} />}
      {aba === "mypoupar" && <ModuloView modulo={modulo("mypoupar")} feito={!!progresso["mypoupar-site"]} onPassou={() => passou("mypoupar-site")} extra={<MyPouparEmbed />} />}
      {aba === "natal" && <ModuloView modulo={modulo("natal")} feito={!!progresso.natal} onPassou={() => passou("natal")} />}
      {aba === "operadora" && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {operadoras.map((m) => (
              <button key={m.id} type="button" onClick={() => setOpId(m.id)}
                style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${opAtual.id === m.id ? "#4F46E5" : "#E2E8F0"}`, background: opAtual.id === m.id ? "#4F46E5" : "#fff", color: opAtual.id === m.id ? "#fff" : "#334155" }}>
                {progresso[m.id] ? "✓ " : ""}{m.titulo}
              </button>
            ))}
          </div>
          <ModuloView key={opAtual.id} modulo={opAtual} feito={!!progresso[opAtual.id]} onPassou={() => passou(opAtual.id)}
            extra={<CampanhasDaOperadora operadora={opAtual.operadora || opAtual.titulo} tipo={opAtual.tipo} />} />
        </>
      )}
      {aba === "materiais" && <MateriaisEmpresa />}
    </div>
  );
}
