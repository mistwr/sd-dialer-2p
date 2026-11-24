"use client";

import { useState } from "react";
import useSWR from "swr";
import { Search, ShieldAlert, ShieldCheck, Upload } from "lucide-react";

type Info = {
  carga: { ficheiro: string | null; data_lista: string | null; total: number; created_at: string } | null;
  pode_carregar: boolean;
};
type Resultado = { encontrado: boolean; nif_valido: boolean; data_lista: string | null; carregada_em: string };

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const dia = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-PT") : null);

export function ConsultaDividaPage() {
  const { data: info, mutate } = useSWR<Info>("/api/endesa-divida?info=1", fetcher);
  const [nif, setNif] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [nifConsultado, setNifConsultado] = useState("");

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    const n = nif.replace(/\s/g, "");
    setErro("");
    setRes(null);
    if (!/^\d{9}$/.test(n)) return setErro("O NIF tem de ter 9 dígitos.");
    setLoading(true);
    try {
      const r = await fetch(`/api/endesa-divida?nif=${n}`);
      const j = await r.json();
      if (!r.ok) setErro(j.error || "Não foi possível consultar.");
      else {
        setRes(j);
        setNifConsultado(n);
      }
    } catch {
      setErro("Sem ligação. Tenta outra vez.");
    }
    setLoading(false);
  }

  const dataLista = dia(info?.carga?.data_lista ?? null) || dia(info?.carga?.created_at ?? null);

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Dívida Endesa por NIF</h1>
      <p style={{ color: "#64748B", marginBottom: 16 }}>
        Antes de propor a mudança para a Endesa, vê se o cliente tem dívida de energia registada.
      </p>

      {info && !info.carga && (
        <p style={{ padding: 12, borderRadius: 10, background: "#FEF3C7", color: "#92400E", marginBottom: 16 }}>
          Ainda não foi carregada nenhuma lista.{info.pode_carregar ? " Carrega-a mais abaixo." : " Pede ao administrador para a carregar."}
        </p>
      )}

      <form onSubmit={consultar} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={nif}
          onChange={(e) => setNif(e.target.value.replace(/[^\d\s]/g, "").slice(0, 11))}
          inputMode="numeric"
          placeholder="NIF do cliente (9 dígitos)"
          autoComplete="off"
          style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 18, letterSpacing: 1 }}
        />
        <button
          type="submit"
          disabled={loading || !info?.carga}
          style={{ padding: "0 18px", borderRadius: 10, background: "#4F46E5", color: "#fff", fontWeight: 600, border: 0, display: "flex", alignItems: "center", gap: 6, opacity: loading || !info?.carga ? 0.6 : 1 }}
        >
          <Search size={18} /> {loading ? "..." : "Consultar"}
        </button>
      </form>

      {erro && <p style={{ color: "#B91C1C", marginBottom: 12 }}>{erro}</p>}

      {res && res.encontrado && (
        <div style={{ padding: 16, borderRadius: 14, background: "#FEF2F2", border: "1.5px solid #FCA5A5", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#B91C1C", fontSize: 17 }}>
            <ShieldAlert size={22} /> Consta na lista de dívida Endesa
          </div>
          <p style={{ margin: "8px 0 0", color: "#7F1D1D", fontSize: 14 }}>
            NIF {nifConsultado}. Lista de {dia(res.data_lista) || dia(res.carregada_em)}.
          </p>
          <ul style={{ margin: "10px 0 0 18px", color: "#7F1D1D", fontSize: 14, lineHeight: 1.5 }}>
            <li>Não prometas a mudança. Uma dívida por regularizar pode impedir ou atrasar a troca de comercializador.</li>
            <li>Explica ao cliente com calma e sugere-lhe regularizar a dívida ou falar com a Endesa (800 10 10 33).</li>
            <li>Podes propor outra comercializadora no entretanto. Regista a nota na lead.</li>
          </ul>
        </div>
      )}

      {res && !res.encontrado && (
        <div style={{ padding: 16, borderRadius: 14, background: "#F0FDF4", border: "1.5px solid #86EFAC", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#15803D", fontSize: 17 }}>
            <ShieldCheck size={22} /> Não consta na lista
          </div>
          <p style={{ margin: "8px 0 0", color: "#166534", fontSize: 14 }}>
            NIF {nifConsultado}. Lista de {dia(res.data_lista) || dia(res.carregada_em)}. A lista pode estar desatualizada: confirma sempre antes de fechar.
          </p>
          {!res.nif_valido && (
            <p style={{ margin: "8px 0 0", color: "#92400E", fontSize: 13 }}>Atenção: este NIF não passa a validação. Confirma se está bem escrito.</p>
          )}
        </div>
      )}

      {dataLista && (
        <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 24 }}>
          Lista atual: {dataLista}. Cada consulta fica registada.
        </p>
      )}

      {info?.pode_carregar && <CarregarLista onDone={() => mutate()} />}
    </div>
  );
}

function CarregarLista({ onDone }: { onDone: () => void }) {
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState(false);
  const [dataLista, setDataLista] = useState("");

  async function carregar(file: File) {
    setBusy(true);
    try {
      setEstado("A ler o ficheiro...");
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const linhas = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false }) as any[][];
      const nifs = Array.from(
        new Set(linhas.map((l) => String(l?.[0] ?? "").replace(/\s/g, "")).filter((n) => /^\d{9}$/.test(n))),
      );
      if (!nifs.length) throw new Error("Não encontrei NIFs de 9 dígitos na primeira coluna.");

      let cargaId = "";
      const bloco = 5000;
      for (let i = 0; i < nifs.length; i += bloco) {
        setEstado(`A carregar ${Math.min(i + bloco, nifs.length).toLocaleString("pt-PT")} de ${nifs.length.toLocaleString("pt-PT")}...`);
        const r = await fetch("/api/endesa-divida", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ficheiro: file.name, data_lista: dataLista || null, carga_id: cargaId || undefined, nifs: nifs.slice(i, i + bloco) }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Falhou um bloco.");
        cargaId = j.carga_id;
      }
      const f = await fetch("/api/endesa-divida", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concluir: true, carga_id: cargaId }),
      });
      const fj = await f.json();
      if (!f.ok) throw new Error(fj.error || "Falhou a conclusão.");
      setEstado(`Pronto: ${Number(fj.total).toLocaleString("pt-PT")} NIFs carregados. A lista anterior foi substituída.`);
      onDone();
    } catch (e: any) {
      setEstado("Erro: " + (e?.message || "falhou"));
    }
    setBusy(false);
  }

  return (
    <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Carregar lista (só administradores)</div>
      <p style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>
        Excel ou CSV com os NIFs na primeira coluna. Substitui a lista anterior. Ninguém vê a lista, só se consulta NIF a NIF.
      </p>
      <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
        Data da lista{" "}
        <input type="date" value={dataLista} onChange={(e) => setDataLista(e.target.value)}
          style={{ marginLeft: 6, padding: "6px 8px", borderRadius: 8, border: "1.5px solid #E2E8F0" }} />
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: busy ? "#94A3B8" : "#0F766E", color: "#fff", fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
        <Upload size={16} /> Escolher ficheiro
        <input type="file" accept=".xlsx,.xls,.csv" disabled={busy} style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) carregar(f); e.currentTarget.value = ""; }} />
      </label>
      {estado && <p style={{ fontSize: 13, marginTop: 10, color: estado.startsWith("Erro") ? "#B91C1C" : "#334155" }}>{estado}</p>}
    </div>
  );
}
