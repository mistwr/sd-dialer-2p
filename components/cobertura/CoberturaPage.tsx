"use client";

import { useState } from "react";
import { ExternalLink, MapPin, Sparkles } from "lucide-react";

const OPERADORAS = ["MEO", "NOS", "Vodafone", "Digi"];
const TECHS: Array<[string, string]> = [
  ["ftth", "Fibra"],
  ["hfc", "Cabo"],
  ["cobre", "Cobre"],
  ["sem", "Nada"],
];
const GEO_URL = "https://geo.anacom.pt/publico/home";

type Cob = Record<string, { tech: string; dois_gb: boolean }>;

function Texto({ t }: { t: string }) {
  return (
    <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55, color: "#1E293B" }}>
      {t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </div>
  );
}

export function CoberturaPage() {
  const [morada, setMorada] = useState("");
  const [cob, setCob] = useState<Cob>({});
  const [atual, setAtual] = useState("");
  const [tv, setTv] = useState(true);
  const [movel, setMovel] = useState(true);
  const [paga, setPaga] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [erro, setErro] = useState("");

  async function abrirMapa() {
    try {
      if (morada.trim()) await navigator.clipboard.writeText(morada.trim());
    } catch {}
    window.open(GEO_URL, "geo-anacom", "noopener,noreferrer");
  }

  const set = (op: string, patch: Partial<Cob[string]>) =>
    setCob((c) => ({ ...c, [op]: { tech: c[op]?.tech || "nv", dois_gb: c[op]?.dois_gb || false, ...patch } }));

  async function recomendar() {
    setErro("");
    setReply("");
    if (!Object.values(cob).some((c) => c.tech && c.tech !== "nv")) return setErro("Marca o que viste no mapa para pelo menos uma operadora.");
    setBusy(true);
    try {
      const r = await fetch("/api/cobertura", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ morada, cobertura: cob, cliente: { operadoraAtual: atual, tv, movel, paga } }),
      });
      const j = await r.json();
      if (!r.ok) setErro(j.error || "Não foi possível.");
      else setReply(j.reply);
    } catch {
      setErro("Sem ligação. Tenta outra vez.");
    }
    setBusy(false);
  }

  const card: React.CSSProperties = { background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 14, padding: 16, marginBottom: 14 };
  const chip = (on: boolean): React.CSSProperties => ({
    padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer",
    border: "1.5px solid " + (on ? "#4F46E5" : "#E2E8F0"), background: on ? "#4F46E5" : "#fff", color: on ? "#fff" : "#334155",
  });

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Cobertura por morada</h1>
      <p style={{ color: "#64748B", marginBottom: 16 }}>Vê o que chega à morada do cliente e deixa a IA dizer qual a melhor operadora.</p>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>1. Procura a morada no mapa oficial</div>
        <input value={morada} onChange={(e) => setMorada(e.target.value)} placeholder="Morada do cliente"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E2E8F0", marginBottom: 10 }} />
        <button onClick={abrirMapa}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#0F766E", color: "#fff", fontWeight: 600, border: 0 }}>
          <MapPin size={16} /> Abrir mapa da ANACOM <ExternalLink size={14} />
        </button>
        <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 8 }}>
          Abre noutra janela (o site da ANACOM não permite ser mostrado aqui dentro). A morada fica copiada: cola-a em “Coberturas disponíveis”.
        </p>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>2. O que o mapa mostra</div>
        {OPERADORAS.map((op) => (
          <div key={op} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ width: 80, fontWeight: 600 }}>{op}</span>
            {TECHS.map(([v, l]) => (
              <button key={v} onClick={() => set(op, { tech: v })} style={chip(cob[op]?.tech === v)}>{l}</button>
            ))}
            <label style={{ fontSize: 12, color: "#64748B", display: "flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={!!cob[op]?.dois_gb} onChange={(e) => set(op, { dois_gb: e.target.checked })} /> 2 Gbps+
            </label>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>3. O cliente</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={atual} onChange={(e) => setAtual(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1.5px solid #E2E8F0" }}>
            <option value="">Operadora atual</option>
            {OPERADORAS.concat(["Outra"]).map((o) => <option key={o}>{o}</option>)}
          </select>
          <input value={paga} onChange={(e) => setPaga(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" placeholder="Paga hoje (€/mês)"
            style={{ width: 150, padding: "8px 10px", borderRadius: 10, border: "1.5px solid #E2E8F0" }} />
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={tv} onChange={(e) => setTv(e.target.checked)} /> TV</label>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={movel} onChange={(e) => setMovel(e.target.checked)} /> Móvel</label>
        </div>
      </div>

      <button onClick={recomendar} disabled={busy}
        style={{ width: "100%", padding: "13px 16px", borderRadius: 12, background: "#4F46E5", color: "#fff", fontWeight: 700, fontSize: 16, border: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, opacity: busy ? 0.7 : 1 }}>
        <Sparkles size={18} /> {busy ? "A analisar..." : "Qual a melhor operadora?"}
      </button>

      {erro && <p style={{ color: "#B91C1C", marginTop: 12 }}>{erro}</p>}
      {reply && (
        <div style={{ ...card, marginTop: 14, background: "#EEF2FF", borderColor: "#C7D2FE" }}>
          <Texto t={reply} />
        </div>
      )}
    </div>
  );
}
