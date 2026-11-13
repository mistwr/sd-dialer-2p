"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteParticipant } from "livekit-client";
import { Mic, MicOff, Pause, Phone, Play, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Lead = { id: string; nome: string | null; telefone: string; localidade: string | null; operador: string | null; observacoes: string | null };
type Phase = "idle" | "connecting" | "dialing" | "talking" | "wrap" | "empty";

async function token() {
  const { data: { session } } = await createClient().auth.getSession();
  return session?.access_token || "";
}
async function api(body: unknown) {
  const res = await fetch("/api/dialer-humano", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await token()) }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erro");
  return json;
}

const RESULTS: [string, string][] = [
  ["interessado", "Interessado"], ["ligar_depois", "Ligar depois"], ["sem_interesse", "Sem interesse"],
  ["caixa_voz", "Caixa de voz"], ["nao_atendeu", "Não atendeu"], ["numero_errado", "Número errado"], ["nao_ligar", "Não ligar mais"],
];

export function MarcadorPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lead, setLead] = useState<Lead | null>(null);
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState(0);
  const [statuses, setStatuses] = useState<string[]>(["novo", "nao_atende"]);
  const [localidade, setLocalidade] = useState("");
  const [operador, setOperador] = useState("");
  const [note, setNote] = useState("");

  const room = useRef<Room | null>(null);
  const callId = useRef("");
  const identity = useRef("");
  const answered = useRef(false);
  const tried = useRef<string[]>([]);
  const pausedRef = useRef(false);
  const runningRef = useRef(false);
  const audioHost = useRef<HTMLDivElement>(null);

  pausedRef.current = paused;

  const nextLead = useCallback(async () => {
    if (!runningRef.current || pausedRef.current) { setPhase("idle"); setLead(null); return; }
    setMsg(""); setNote(""); answered.current = false;
    try {
      const r = await api({ action: "next", filters: { statuses, localidade, operador }, exclude: tried.current });
      if (r.empty) { setPhase("empty"); setLead(null); runningRef.current = false; return; }
      callId.current = r.callId; identity.current = r.identity; tried.current.push(r.lead.id);
      setLead(r.lead); setPhase("dialing"); setStatus("A ligar…");
    } catch (e) { setMsg((e as Error).message); setPhase("idle"); runningRef.current = false; }
  }, [statuses, localidade, operador]);

  const finish = useCallback(async (result: string) => {
    if (!callId.current) return;
    const id = callId.current; callId.current = "";
    try { await api({ action: "finish", callId: id, result, note }); setDone(n => n + 1); } catch (e) { setMsg((e as Error).message); }
    setLead(null);
    await nextLead();
  }, [note, nextLead]);

  const finishRef = useRef(finish); finishRef.current = finish;

  const onSipChange = useCallback((p: RemoteParticipant) => {
    if (p.identity !== identity.current) return;
    const s = p.attributes["sip.callStatus"];
    if (s === "active") { answered.current = true; setPhase("talking"); setStatus("Em chamada"); }
    else if (s === "ringing" || s === "dialing") setStatus(s === "ringing" ? "A tocar…" : "A ligar…");
  }, []);

  async function play() {
    setMsg(""); setPaused(false); runningRef.current = true; tried.current = []; setDone(0); setPhase("connecting");
    try {
      const s = await api({ action: "session" });
      const r = new Room({ adaptiveStream: true });
      r.on(RoomEvent.TrackSubscribed, (t, _pub, p) => {
        if (t.kind === Track.Kind.Audio && p.identity.startsWith("sip-")) { const el = t.attach(); el.autoplay = true; audioHost.current?.appendChild(el); }
      });
      r.on(RoomEvent.TrackUnsubscribed, t => t.detach().forEach(el => el.remove()));
      r.on(RoomEvent.ParticipantAttributesChanged, (_c, p) => onSipChange(p as RemoteParticipant));
      r.on(RoomEvent.ParticipantConnected, p => onSipChange(p));
      r.on(RoomEvent.ParticipantDisconnected, p => {
        if (p.identity !== identity.current) return;
        if (answered.current) { setPhase("wrap"); setStatus("Chamada terminada"); }
        else void finishRef.current("nao_atendeu");
      });
      r.on(RoomEvent.Disconnected, () => { room.current = null; if (runningRef.current) { runningRef.current = false; setPhase("idle"); setMsg("Ligação perdida. Carrega em Play para continuar."); } });
      await r.connect(s.url, s.token);
      await r.localParticipant.setMicrophoneEnabled(true);
      room.current = r;
      await nextLead();
    } catch (e) { setMsg((e as Error).message || "Não foi possível começar."); setPhase("idle"); runningRef.current = false; }
  }

  async function stop() {
    runningRef.current = false;
    if (callId.current) { const id = callId.current; callId.current = ""; await api({ action: "finish", callId: id, result: answered.current ? "ligar_depois" : "nao_atendeu" }).catch(() => null); }
    room.current?.disconnect(); room.current = null; setPhase("idle"); setLead(null);
  }

  async function toggleMute() { const m = !muted; setMuted(m); await room.current?.localParticipant.setMicrophoneEnabled(!m); }
  useEffect(() => () => { runningRef.current = false; room.current?.disconnect(); }, []);

  const input = { padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" } as const;
  const active = phase === "dialing" || phase === "talking" || phase === "wrap";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}><Phone size={22} /> Marcador</h1>
      <p style={{ color: "#64748b", fontSize: 14 }}>Carrega em Play: o sistema liga às leads e, quando alguém atende, falas tu (pelo microfone deste aparelho). Usa auscultadores. Mantém esta página aberta.</p>

      {!runningRef.current && phase !== "connecting" && (
        <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 13 }}>
          <div>Leads com estado: {[["novo", "Novas"], ["nao_atende", "Não atendeu"], ["ligar_depois", "Ligar depois"]].map(([v, l]) => (
            <label key={v} style={{ marginRight: 10 }}><input type="checkbox" checked={statuses.includes(v)} onChange={e => setStatuses(s => e.target.checked ? [...s, v] : s.filter(x => x !== v))} /> {l}</label>
          ))}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <input value={localidade} onChange={e => setLocalidade(e.target.value)} placeholder="Localidade (opcional)" style={input} />
            <input value={operador} onChange={e => setOperador(e.target.value)} placeholder="Operador atual (opcional)" style={input} />
          </div>
        </section>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {phase === "idle" || phase === "empty"
          ? <button onClick={play} style={{ padding: "10px 18px", borderRadius: 10, background: "#16a34a", color: "#fff", border: 0 }}><Play size={16} /> Play</button>
          : <>
              <button onClick={() => setPaused(p => !p)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1" }}>{paused ? <><Play size={16} /> Retomar</> : <><Pause size={16} /> Pausar</>}</button>
              <button onClick={toggleMute} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1" }}>{muted ? <MicOff size={16} /> : <Mic size={16} />} {muted ? "Sem som" : "Microfone"}</button>
              <button onClick={stop} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #dc2626", color: "#dc2626" }}><Square size={16} /> Parar</button>
            </>}
        <span style={{ alignSelf: "center", fontSize: 13, color: "#64748b" }}>{done} chamadas feitas{paused && active ? " · pausa depois desta" : ""}</span>
      </div>

      {phase === "connecting" && <p>A ligar o microfone…</p>}
      {phase === "empty" && <p>Não há mais leads com estes filtros. 🎉</p>}
      {msg && <p style={{ color: "#b91c1c", fontSize: 14 }}>{msg}</p>}

      {lead && active && (
        <section style={{ border: "2px solid " + (phase === "talking" ? "#16a34a" : "#e2e8f0"), borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>{status}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{lead.nome || "(sem nome)"}</div>
          <div>{lead.telefone}{lead.localidade ? " · " + lead.localidade : ""}{lead.operador ? " · " + lead.operador : ""}</div>
          {lead.observacoes && <p style={{ fontSize: 13, background: "#f8fafc", padding: 8, borderRadius: 8 }}>{lead.observacoes}</p>}
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota da chamada (opcional)" style={{ ...input, width: "100%", marginTop: 8 }} rows={2} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {RESULTS.map(([v, l]) => (
              <button key={v} onClick={() => finish(v)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: phase === "wrap" ? "#0f172a" : "#fff", color: phase === "wrap" ? "#fff" : "#0f172a" }}>{l}</button>
            ))}
          </div>
          {phase !== "wrap" && <p style={{ fontSize: 12, color: "#64748b", marginBottom: 0 }}>Qualquer botão desliga e passa à lead seguinte.</p>}
        </section>
      )}
      <div ref={audioHost} />
    </div>
  );
}
