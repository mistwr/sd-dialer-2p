"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { FileText, Image as ImageIcon, Search } from "lucide-react";
import { PageSpinner } from "@/components/ui/Spinner";

type Ficheiro = { id: string; file_name: string; file_type: string | null; file_size: number | null };
type Campanha = {
  id: string;
  title: string;
  description: string | null;
  operator: string | null;
  service_type: string | null;
  published_at: string | null;
  campanhas_operadoras_ficheiros: Ficheiro[];
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function kb(n: number | null) {
  if (!n) return "";
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

export function CampanhasOperadorasPage() {
  const { data, isLoading } = useSWR<{ campanhas: Campanha[] }>("/api/campanhas-operadoras", fetcher);
  const [q, setQ] = useState("");
  const [op, setOp] = useState("Todas");
  const [tipo, setTipo] = useState("todos");

  const campanhas = data?.campanhas ?? [];
  const operadoras = useMemo(
    () => ["Todas", ...Array.from(new Set(campanhas.map((c) => c.operator).filter(Boolean) as string[])).sort()],
    [campanhas]
  );
  const lista = campanhas.filter((c) => {
    if (op !== "Todas" && c.operator !== op) return false;
    if (tipo !== "todos" && c.service_type !== tipo) return false;
    const t = `${c.title} ${c.description ?? ""} ${c.operator ?? ""}`.toLowerCase();
    return t.includes(q.toLowerCase());
  });

  if (isLoading) return <PageSpinner />;

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer",
    border: "1.5px solid " + (active ? "#4F46E5" : "#E2E8F0"),
    background: active ? "#4F46E5" : "#fff", color: active ? "#fff" : "#334155",
  });

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Campanhas das operadoras</h1>
      <p style={{ color: "#64748B", marginBottom: 16 }}>Campanhas ativas e respetivos ficheiros (tabelas, fichas, condições).</p>
      <a href="/simulador-energia"
        style={{ display: "inline-block", marginBottom: 16, padding: "8px 14px", borderRadius: 10, background: "#0F766E", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        ⚡ Simulador de eletricidade
      </a>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 11, color: "#94A3B8" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar campanha..."
            style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, border: "1.5px solid #E2E8F0" }} />
        </div>
        {[["todos", "Todos"], ["telecom", "Telecom"], ["energia", "Energia"]].map(([v, l]) => (
          <button key={v} onClick={() => setTipo(v)} style={pill(tipo === v)}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {operadoras.map((o) => (
          <button key={o} onClick={() => setOp(o)} style={pill(op === o)}>{o}</button>
        ))}
      </div>

      {lista.length === 0 && <p style={{ color: "#64748B" }}>Nenhuma campanha encontrada.</p>}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {lista.map((c) => (
          <div key={c.id} style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4F46E5" }}>{c.operator}</span>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>
                {c.service_type === "energia" ? "Energia" : "Telecom"}
                {c.published_at ? ` · ${new Date(c.published_at).toLocaleDateString("pt-PT")}` : ""}
              </span>
            </div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{c.title}</div>
            {c.description && (
              <p style={{ fontSize: 13, color: "#475569", whiteSpace: "pre-wrap", marginBottom: 10 }}>{c.description}</p>
            )}
            <div style={{ display: "grid", gap: 6 }}>
              {c.campanhas_operadoras_ficheiros.map((f) => (
                <a key={f.id} href={`/api/campanhas-operadoras/ficheiro?id=${f.id}`} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 10px",
                    borderRadius: 8, background: "#F8FAFC", color: "#0F172A", textDecoration: "none" }}>
                  {f.file_type === "image" ? <ImageIcon size={16} /> : <FileText size={16} />}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</span>
                  <span style={{ color: "#94A3B8", fontSize: 12 }}>{kb(f.file_size)}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
