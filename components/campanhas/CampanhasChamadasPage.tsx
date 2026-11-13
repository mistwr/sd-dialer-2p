"use client";

import { useState } from "react";
import useSWR from "swr";
import { Pause, Play, Square, PhoneCall } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageSpinner } from "@/components/ui/Spinner";

type Lead = { id: string; nome: string | null; telefone: string; status: string; localidade: string | null; operador: string | null };
type Campaign = {
  id: string; name: string; status: "running" | "paused" | "stopped" | "done";
  concurrency: number; calls_per_hour: number; window_start: number; window_end: number;
  last_note: string | null; last_tick_at: string | null;
  counts: { pending: number; calling: number; done: number; skipped: number }; total: number;
  outcome: { conversas: number; caixa_voz: number; sem_resposta: number; interesse: number };
};

async function token() {
  const { data: { session } } = await createClient().auth.getSession();
  return session?.access_token || "";
}
async function api(method: string, body?: unknown) {
  const res = await fetch("/api/campanhas-chamadas", {
    method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await token()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erro");
  return json;
}
const fetcher = async () => api("GET");

const STATUS_LABEL = { running: "A correr", paused: "Em pausa", stopped: "Parada", done: "Concluída" } as const;
const LEAD_STATES = [["novo", "Novas"], ["nao_atende", "Não atendeu"], ["ligar_depois", "Ligar depois"]] as const;

export function CampanhasChamadasPage() {
  const { data, isLoading, mutate } = useSWR<{ campaigns: Campaign[] }>("campanhas-chamadas", fetcher, { refreshInterval: 8000 });
  const [name, setName] = useState("");
  const [statuses, setStatuses] = useState<string[]>(["novo"]);
  const [limit, setLimit] = useState(200);
  const [perHour, setPerHour] = useState(30);
  const [concurrency, setConcurrency] = useState(1);
  const [start, setStart] = useState(10);
  const [end, setEnd] = useState(20);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [campanhaId, setCampanhaId] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [operador, setOperador] = useState("");
  const [texto, setTexto] = useState("");
  const [lista, setLista] = useState<{ leads: Lead[]; total: number; campanhas: { id: string; name: string }[] } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  async function verLeads() {
    setBusy(true); setMsg("");
    try {
      const qs = new URLSearchParams({ statuses: statuses.join(","), campanha_id: campanhaId, localidade, operador, q: texto });
      const res = await fetch("/api/campanhas-chamadas/leads?" + qs, { headers: { Authorization: "Bearer " + (await token()) } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro");
      setLista(json); setPicked([]);
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true); setMsg("");
    try { await fn(); if (ok) setMsg(ok); await mutate(); } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  if (isLoading) return <PageSpinner />;
  const campaigns = data?.campaigns ?? [];
  const input = { padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", width: 80 } as const;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}><PhoneCall size={22} /> Campanhas de chamadas automáticas</h1>
      <p style={{ color: "#64748b", fontSize: 14 }}>O robot liga sozinho às leads da campanha, no servidor — podes fechar a página. Só liga nas horas definidas (seg–sáb) e não volta a ligar a quem já contactou nas últimas 12 h.</p>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, margin: "14px 0" }}>
        <strong>Nova campanha</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, alignItems: "end", fontSize: 13 }}>
          <label>Nome<br /><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Telecom Porto" style={{ ...input, width: 170 }} /></label>
          <div>Leads com estado<br />{LEAD_STATES.map(([v, l]) => (
            <label key={v} style={{ marginRight: 8 }}><input type="checkbox" checked={statuses.includes(v)} onChange={e => setStatuses(s => e.target.checked ? [...s, v] : s.filter(x => x !== v))} /> {l}</label>
          ))}</div>
          <label>Máx. leads<br /><input type="number" value={limit} min={1} max={2000} onChange={e => setLimit(+e.target.value)} style={input} /></label>
          <label>Chamadas/hora<br /><input type="number" value={perHour} min={1} max={300} onChange={e => setPerHour(+e.target.value)} style={input} /></label>
          <label>Em simultâneo<br /><select value={concurrency} onChange={e => setConcurrency(+e.target.value)} style={input}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
          <label>Das<br /><input type="number" value={start} min={0} max={23} onChange={e => setStart(+e.target.value)} style={{ ...input, width: 60 }} />h</label>
          <label>Às<br /><input type="number" value={end} min={1} max={24} onChange={e => setEnd(+e.target.value)} style={{ ...input, width: 60 }} />h</label>
          <button disabled={busy} onClick={() => run(() => api("POST", { name, statuses, limit, lead_ids: picked, campanha_id: campanhaId || undefined, localidade, operador, calls_per_hour: perHour, concurrency, window_start: start, window_end: end }), "Campanha criada em pausa. Carrega em Play.")}
            style={{ padding: "8px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", border: 0 }}>Criar</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "end", fontSize: 13 }}>
          <label>Campanha da lead<br /><select value={campanhaId} onChange={e => setCampanhaId(e.target.value)} style={{ ...input, width: 170 }}><option value="">Todas</option>{(lista?.campanhas ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Localidade<br /><input value={localidade} onChange={e => setLocalidade(e.target.value)} placeholder="Porto" style={{ ...input, width: 120 }} /></label>
          <label>Operador atual<br /><input value={operador} onChange={e => setOperador(e.target.value)} placeholder="MEO" style={{ ...input, width: 110 }} /></label>
          <label>Nome ou telefone<br /><input value={texto} onChange={e => setTexto(e.target.value)} style={{ ...input, width: 140 }} /></label>
          <button disabled={busy} onClick={verLeads} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #0f172a" }}>Ver leads</button>
        </div>
        {lista && <div style={{ marginTop: 10, fontSize: 13 }}>
          <div><strong>{lista.total}</strong> leads com estes filtros (mostro as primeiras {lista.leads.length}). {picked.length ? picked.length + " selecionadas: só estas entram." : "Sem seleção: entram as primeiras " + Math.min(limit, lista.total) + " (Máx. leads)."}
            {" "}<button onClick={() => setPicked(picked.length === lista.leads.length ? [] : lista.leads.map(l => l.id))} style={{ textDecoration: "underline" }}>{picked.length === lista.leads.length ? "Limpar" : "Selecionar as mostradas"}</button></div>
          <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, marginTop: 6 }}>
            {lista.leads.map(l => (
              <label key={l.id} style={{ display: "flex", gap: 8, padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>
                <input type="checkbox" checked={picked.includes(l.id)} onChange={e => setPicked(p => e.target.checked ? [...p, l.id] : p.filter(x => x !== l.id))} />
                <span style={{ minWidth: 140 }}>{l.nome || "(sem nome)"}</span><span style={{ minWidth: 100 }}>{l.telefone}</span><span style={{ color: "#64748b" }}>{l.status}{l.localidade ? " · " + l.localidade : ""}{l.operador ? " · " + l.operador : ""}</span>
              </label>
            ))}
          </div>
        </div>}
        {concurrency > 1 && <p style={{ fontSize: 12, color: "#b45309", marginBottom: 0 }}>Chamadas em simultâneo ainda não foram testadas com carga: confirma antes que o teu Twilio/SIP permite várias linhas.</p>}
        {msg && <p style={{ fontSize: 13, marginBottom: 0 }}>{msg}</p>}
      </section>

      {campaigns.length === 0 && <p style={{ color: "#64748b" }}>Ainda não há campanhas.</p>}
      {campaigns.map(c => {
        const finished = c.counts.done + c.counts.skipped;
        const pct = c.total ? Math.round((finished / c.total) * 100) : 0;
        const over = c.status === "done" || c.status === "stopped";
        return (
          <section key={c.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div><strong>{c.name}</strong> <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 99, background: c.status === "running" ? "#dcfce7" : "#f1f5f9" }}>{STATUS_LABEL[c.status]}</span></div>
              {!over && <div style={{ display: "flex", gap: 6 }}>
                {c.status === "running"
                  ? <button disabled={busy} onClick={() => run(() => api("PATCH", { id: c.id, action: "pause" }))}><Pause size={14} /> Pausar</button>
                  : <button disabled={busy} onClick={() => run(() => api("PATCH", { id: c.id, action: "play" }))}><Play size={14} /> Play</button>}
                <button disabled={busy} onClick={() => confirm("Parar de vez? As leads por ligar são descartadas.") && run(() => api("PATCH", { id: c.id, action: "stop" }))}><Square size={14} /> Parar</button>
              </div>}
            </div>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 99, margin: "10px 0" }}><div style={{ width: pct + "%", height: 8, background: "#22c55e", borderRadius: 99 }} /></div>
            <div style={{ fontSize: 13, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>{finished}/{c.total} feitas ({pct}%)</span><span>Por ligar: {c.counts.pending}</span><span>A ligar: {c.counts.calling}</span>
              <span>Conversas: {c.outcome.conversas}</span><span>Interesse: {c.outcome.interesse}</span><span>Caixa de voz: {c.outcome.caixa_voz}</span><span>Sem resposta: {c.outcome.sem_resposta}</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{c.window_start}h–{c.window_end}h · máx. {c.calls_per_hour}/hora · {c.concurrency} em simultâneo{c.last_note ? " · " + c.last_note : ""}</div>
          </section>
        );
      })}
    </div>
  );
}
