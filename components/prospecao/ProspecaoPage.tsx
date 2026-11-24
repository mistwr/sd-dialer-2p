"use client";

import { useState } from "react";
import { Building2, ExternalLink, MapPin, MessageCircle, Phone, Save, Search } from "lucide-react";

type Neg = {
  nome: string; telefone: string | null; email: string | null; morada: string | null; localidade: string | null;
  site: string | null; redes: string | null; fonte_url: string | null; sugestao: string | null; distancia_km: number | null;
};

const RAIOS = [5, 15, 30, 50];

export function ProspecaoPage() {
  const [query, setQuery] = useState("");
  const [local, setLocal] = useState("");
  const [raio, setRaio] = useState(15);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [res, setRes] = useState<Neg[]>([]);
  const [guardados, setGuardados] = useState<Record<string, boolean>>({});

  async function ultimaGuardada() {
    try {
      const r = await fetch("/api/localizacao?me=1", { cache: "no-store" });
      const j = await r.json();
      return j?.posicao as { lat: number; lng: number; updated_at: string } | null;
    } catch { return null; }
  }

  function usarLocalizacao() {
    setErro(""); setAviso("");
    const fallback = async (motivo: string) => {
      const g = await ultimaGuardada();
      if (g) {
        const min = Math.max(1, Math.round((Date.now() - new Date(g.updated_at).getTime()) / 60000));
        setPos({ lat: g.lat, lng: g.lng }); setLocal("");
        setAviso(`Usei a tua última posição guardada (há ${min < 120 ? min + " min" : Math.round(min / 60) + " h"}).`);
      } else setErro(motivo + " Escreve a cidade ou ativa a localização do site nas definições do browser.");
    };
    if (!navigator.geolocation) return void fallback("Este aparelho não dá a localização.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocal("");
        fetch("/api/localizacao", { method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
          body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }) }).catch(() => {});
      },
      () => { void fallback("Não deu para obter a localização."); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  }

  async function pesquisar() {
    setErro(""); setAviso(""); setRes([]);
    if (query.trim().length < 3) return setErro("Escreve o tipo de negócio (ex.: restaurantes).");
    if (!pos && !local.trim()) return setErro("Escreve a cidade ou usa a tua localização.");
    setBusy(true);
    try {
      const r = await fetch("/api/prospecao", {
        signal: AbortSignal.timeout(65000),
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, local, raioKm: raio, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }),
      });
      const j = await r.json();
      if (!r.ok) setErro(j.error || "Não foi possível.");
      else { setRes(j.resultados || []); if (j.aviso) setAviso(j.aviso); else if (!(j.resultados || []).length) setAviso("Sem resultados. Tenta outro termo, cidade ou raio maior."); }
    } catch (e: any) { setErro(e?.name === "TimeoutError" ? "A pesquisa demorou demasiado. Tenta outra vez com um termo mais simples." : "Sem ligação. Tenta outra vez."); }
    setBusy(false);
  }

  async function guardar(lista: Neg[]) {
    setErro("");
    try {
      const r = await fetch("/api/prospecao/guardar", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ negocios: lista }),
      });
      const j = await r.json();
      if (!r.ok) return setErro(j.error || "Não foi possível guardar.");
      setGuardados((g) => { const n = { ...g }; lista.forEach((x) => { if (x.telefone) n[x.telefone] = true; }); return n; });
      setAviso(`${j.guardadas} guardada(s) nas tuas leads${j.repetidas ? `, ${j.repetidas} já existiam` : ""}.`);
    } catch { setErro("Sem ligação. Tenta outra vez."); }
  }

  const card: React.CSSProperties = { background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 14, padding: 14, marginBottom: 12 };
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 15, boxSizing: "border-box" };
  const chip = (on: boolean): React.CSSProperties => ({ padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", border: "1.5px solid " + (on ? "#4F46E5" : "#E2E8F0"), background: on ? "#4F46E5" : "#fff", color: on ? "#fff" : "#334155" });
  const btn = (bg: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, background: bg, color: "#fff", fontWeight: 600, fontSize: 14, border: 0, textDecoration: "none", cursor: "pointer" });
  const comTel = res.filter((x) => x.telefone && !guardados[x.telefone]);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, display: "flex", gap: 8, alignItems: "center" }}><Building2 size={24} /> Empresas</h1>
      <p style={{ color: "#64748B", marginBottom: 16 }}>Diz o tipo de negócio e a zona. A IA procura e dá-te empresas com contacto para ligares e ofereceres serviços.</p>

      <div style={card}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tipo de negócio (ex.: restaurantes, clínicas, oficinas)" style={{ ...inp, marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input value={local} onChange={(e) => { setLocal(e.target.value); if (e.target.value) setPos(null); }} placeholder="Cidade (Porto, Lisboa...)" style={{ ...inp, flex: 1, minWidth: 180 }} />
          <button onClick={usarLocalizacao} style={{ ...btn(pos ? "#0F766E" : "#475569") }}><MapPin size={16} /> {pos ? "Perto de mim ✓" : "Perto de mim"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>Raio:</span>
          {RAIOS.map((r) => <button key={r} onClick={() => setRaio(r)} style={chip(raio === r)}>{r} km</button>)}
        </div>
        <button onClick={pesquisar} disabled={busy} style={{ ...btn("#4F46E5"), width: "100%", justifyContent: "center", padding: 13, fontSize: 16, opacity: busy ? 0.7 : 1 }}>
          <Search size={18} /> {busy ? "A pesquisar (até 30 s)..." : "Pesquisar empresas"}
        </button>
      </div>

      {erro && <p style={{ color: "#B91C1C" }}>{erro}</p>}
      {aviso && <p style={{ color: "#0F766E" }}>{aviso}</p>}

      {comTel.length > 1 && (
        <button onClick={() => guardar(comTel)} style={{ ...btn("#0F766E"), marginBottom: 12 }}><Save size={16} /> Guardar os {comTel.length} com telefone</button>
      )}

      {res.map((n, i) => (
        <div key={i} style={card}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{n.nome}</div>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 6 }}>
            {[n.morada || n.localidade, n.distancia_km != null ? `~${n.distancia_km} km` : ""].filter(Boolean).join(" · ")}
          </div>
          {n.sugestao && <div style={{ fontSize: 13, background: "#EEF2FF", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>💡 {n.sugestao}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {n.telefone ? (
              <>
                <a href={`tel:+351${n.telefone}`} style={btn("#16A34A")}><Phone size={15} /> Ligar {n.telefone}</a>
                <a href={`https://wa.me/351${n.telefone}`} target="_blank" rel="noopener noreferrer" style={btn("#22C55E")}><MessageCircle size={15} /> WhatsApp</a>
                <button onClick={() => guardar([n])} disabled={guardados[n.telefone]} style={{ ...btn("#4F46E5"), opacity: guardados[n.telefone] ? 0.6 : 1 }}>
                  <Save size={15} /> {guardados[n.telefone] ? "Guardada" : "Guardar lead"}
                </button>
              </>
            ) : <span style={{ fontSize: 13, color: "#B45309" }}>Sem telefone encontrado. Vê nas ligações abaixo.</span>}
            {n.site && <a href={n.site} target="_blank" rel="noopener noreferrer" style={btn("#475569")}><ExternalLink size={14} /> Site</a>}
            {n.redes && <a href={n.redes} target="_blank" rel="noopener noreferrer" style={btn("#475569")}><ExternalLink size={14} /> Redes</a>}
            <a href={`https://www.pai.pt/q/business/advanced?what=${encodeURIComponent(n.nome)}&where=${encodeURIComponent(n.localidade || "")}`} target="_blank" rel="noopener noreferrer" style={btn("#94A3B8")}><ExternalLink size={14} /> Páginas Amarelas</a>
          </div>
        </div>
      ))}
      {res.length > 0 && <p style={{ fontSize: 12, color: "#94A3B8" }}>Contactos lidos de páginas públicas. Confirma o telefone na chamada. Empresas na Lista Robinson não devem ser contactadas para marketing.</p>}
    </div>
  );
}
