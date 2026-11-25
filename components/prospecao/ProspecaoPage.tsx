"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  Building2, Check, ExternalLink, Globe, LocateFixed, MapPin, MessageCircle, Phone, Radar, Save, Search, Sparkles,
} from "lucide-react";

type Neg = {
  nome: string; telefone: string | null; email: string | null; morada: string | null; localidade: string | null;
  site: string | null; redes: string | null; fonte_url: string | null; sugestao: string | null; distancia_km: number | null;
  categoria: string | null; lat: number | null; lng: number | null; origem: "mapa" | "web";
};
type Stats = { total: number; comTelefone: number; mapa: number; web: number };

const RAIOS = [2, 5, 15, 30, 50];
const PRESETS: Array<[string, string]> = [
  ["🍽️", "Restaurantes"], ["☕", "Cafés"], ["🦷", "Dentistas"], ["🩺", "Clínicas"], ["✂️", "Cabeleireiros"], ["🔧", "Oficinas"],
  ["🏠", "Imobiliárias"], ["📊", "Contabilistas"], ["🏋️", "Ginásios"], ["🏨", "Hotéis"], ["🛒", "Mercearias"], ["🧱", "Construção"],
];
const FRASES = ["A varrer o mapa no teu raio…", "A ler telefones e sites…", "A cruzar com a web…", "A preparar o que oferecer…"];

const iniciais = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const hue = (s: string) => s.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const telFmt = (t: string) => t.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");

export function ProspecaoPage() {
  const [query, setQuery] = useState("");
  const [local, setLocal] = useState("");
  const [raio, setRaio] = useState(15);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [frase, setFrase] = useState(0);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [res, setRes] = useState<Neg[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [centro, setCentro] = useState<[number, number] | null>(null);
  const [soTel, setSoTel] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
  const [guardados, setGuardados] = useState<Record<string, boolean>>({});

  const mapaEl = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const L = useRef<any>(null);
  const camada = useRef<any>(null);
  const cartoes = useRef<Record<number, HTMLDivElement | null>>({});

  const lista = useMemo(() => res.map((n, i) => ({ n, i })).filter(({ n }) => !soTel || n.telefone), [res, soTel]);
  const porGuardar = res.filter((x) => x.telefone && !guardados[x.telefone]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setFrase((f) => (f + 1) % FRASES.length), 1800);
    return () => clearInterval(t);
  }, [busy]);

  // mapa (Leaflet) — criado quando há resultados
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!centro || !mapaEl.current) return;
      if (!mapa.current) {
        const leaflet = (await import("leaflet")).default;
        if (cancel || !mapaEl.current) return;
        L.current = leaflet;
        mapa.current = leaflet.map(mapaEl.current, { zoomControl: false, attributionControl: true }).setView(centro, 12);
        leaflet.control.zoom({ position: "bottomright" }).addTo(mapa.current);
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(mapa.current);
        camada.current = leaflet.layerGroup().addTo(mapa.current);
      }
      desenhar();
    })();
    return () => { cancel = true; };
  }, [centro, lista, sel]);

  useEffect(() => () => { if (mapa.current) { mapa.current.remove(); mapa.current = null; } }, []);
  // o mapa sai do ecrã enquanto pesquisa: destruir para recriar no novo contentor
  useEffect(() => { if (busy && mapa.current) { mapa.current.remove(); mapa.current = null; camada.current = null; } }, [busy]);

  function desenhar() {
    if (!mapa.current || !camada.current || !L.current || !centro) return;
    const lf = L.current;
    camada.current.clearLayers();
    lf.circle(centro, { radius: raio * 1000, color: "#818CF8", weight: 1, fillColor: "#6366F1", fillOpacity: 0.06, dashArray: "4 6" }).addTo(camada.current);
    lf.circleMarker(centro, { radius: 7, color: "#fff", weight: 2, fillColor: "#6366F1", fillOpacity: 1 }).addTo(camada.current);
    const pts: [number, number][] = [centro];
    lista.forEach(({ n, i }) => {
      if (n.lat == null || n.lng == null) return;
      const ativo = sel === i;
      lf.circleMarker([n.lat, n.lng], {
        radius: ativo ? 11 : 7, color: ativo ? "#fff" : "rgba(255,255,255,.7)", weight: ativo ? 3 : 1.5,
        fillColor: n.telefone ? "#10B981" : "#64748B", fillOpacity: 0.95,
      }).bindTooltip(n.nome, { direction: "top", offset: [0, -6] })
        .on("click", () => { setSel(i); cartoes.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" }); })
        .addTo(camada.current);
      pts.push([n.lat, n.lng]);
    });
    if (sel == null) mapa.current.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
    else { const s = res[sel]; if (s?.lat != null && s?.lng != null) mapa.current.setView([s.lat, s.lng], Math.max(mapa.current.getZoom(), 15)); }
    setTimeout(() => mapa.current?.invalidateSize(), 50);
  }

  async function ultimaGuardada() {
    try { const r = await fetch("/api/localizacao?me=1", { cache: "no-store" }); return (await r.json())?.posicao || null; } catch { return null; }
  }

  function pertoDeMim() {
    setErro(""); setAviso("");
    const reserva = async () => {
      const g = await ultimaGuardada();
      if (g) { setPos({ lat: g.lat, lng: g.lng }); setLocal(""); setAviso("Usei a tua última posição conhecida."); }
      else setErro("Sem acesso à localização. Escreve a cidade.");
    };
    if (!navigator.geolocation) return void reserva();
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocal("");
        fetch("/api/localizacao", { method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
          body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }) }).catch(() => {});
      },
      () => void reserva(),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  }

  async function pesquisar(q = query) {
    setErro(""); setAviso("");
    if (q.trim().length < 2) return setErro("Escolhe um tipo de negócio em cima ou escreve um.");
    if (!pos && !local.trim()) return setErro("Escreve a cidade ou toca em Perto de mim.");
    setBusy(true); setFrase(0); setSel(null);
    try {
      const r = await fetch("/api/prospecao", {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(65000),
        body: JSON.stringify({ query: q, local, raioKm: raio, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErro(j.error || "Não deu desta vez. Toca outra vez em Pesquisar.");
      else {
        setRes(j.resultados || []); setStats(j.stats || null); setCentro(j.centro || null);
        if (!(j.resultados || []).length) setAviso("Nada neste raio. Aumenta o raio ou experimenta outro tipo de negócio.");
      }
    } catch {
      setErro("A ligação falhou. Toca outra vez em Pesquisar.");
    }
    setBusy(false);
  }

  async function guardar(itens: Neg[]) {
    setErro("");
    try {
      const r = await fetch("/api/prospecao/guardar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ negocios: itens.slice(0, 30) }) });
      const j = await r.json();
      if (!r.ok) return setErro(j.error || "Não foi possível guardar.");
      setGuardados((g) => { const n = { ...g }; itens.forEach((x) => { if (x.telefone) n[x.telefone] = true; }); return n; });
      setAviso(`✓ ${j.guardadas} nas tuas leads${j.repetidas ? ` · ${j.repetidas} já lá estavam` : ""}`);
    } catch { setErro("Sem ligação. Tenta outra vez."); }
  }

  return (
    <div className="px-stage">
      <style>{CSS}</style>

      <header className="px-hero">
        <div className="px-eyebrow"><Radar size={14} /> PROSPEÇÃO INTELIGENTE</div>
        <h1 className="px-title">Encontra empresas<br /><span>para ligar hoje.</span></h1>
        <p className="px-sub">Escolhe o tipo de negócio e a zona. Varremos o mapa e a web, e trazemos contactos prontos a ligar, com o que lhes oferecer.</p>
      </header>

      <section className="px-panel">
        <div className="px-presets">
          {PRESETS.map(([e, l]) => (
            <button key={l} className={"px-chip" + (query === l ? " on" : "")} onClick={() => { setQuery(l); if (pos || local.trim()) pesquisar(l); }}>
              <span>{e}</span>{l}
            </button>
          ))}
        </div>

        <div className="px-row">
          <label className="px-field grow">
            <Building2 size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pesquisar()} placeholder="Tipo de negócio (ex.: pizzarias, oficinas)" />
          </label>
        </div>
        <div className="px-row">
          <label className="px-field grow">
            <MapPin size={18} />
            <input value={pos ? "📍 Perto de mim" : local} onChange={(e) => { setPos(null); setLocal(e.target.value.replace("📍 Perto de mim", "")); }}
              onKeyDown={(e) => e.key === "Enter" && pesquisar()} placeholder="Cidade (Porto, Lisboa, Gaia…)" />
          </label>
          <button className={"px-locate" + (pos ? " on" : "")} onClick={pertoDeMim}><LocateFixed size={18} /> {pos ? "Ativo" : "Perto de mim"}</button>
        </div>

        <div className="px-raio">
          <span>Raio</span>
          <div className="px-seg">
            {RAIOS.map((r) => <button key={r} className={raio === r ? "on" : ""} onClick={() => setRaio(r)}>{r} km</button>)}
          </div>
        </div>

        <button className="px-cta" disabled={busy} onClick={() => pesquisar()}>
          {busy ? <><span className="px-spin" /> {FRASES[frase]}</> : <><Search size={20} /> Encontrar empresas</>}
        </button>

        {erro && <div className="px-msg err">{erro}</div>}
        {aviso && !erro && <div className="px-msg ok">{aviso}</div>}
      </section>

      {busy && (
        <section className="px-loading">
          <div className="px-radar"><div /></div>
          <div className="px-skel">{[0, 1, 2].map((k) => <div key={k} className="px-sk" style={{ animationDelay: `${k * 0.15}s` }} />)}</div>
        </section>
      )}

      {!busy && stats && res.length > 0 && (
        <>
          <section className="px-stats">
            <div><b>{stats.total}</b><span>empresas</span></div>
            <div className="g"><b>{stats.comTelefone}</b><span>com telefone</span></div>
            <div><b>{raio} km</b><span>raio</span></div>
          </section>

          <div className="px-toolbar">
            <button className={"px-toggle" + (soTel ? " on" : "")} onClick={() => setSoTel((v) => !v)}><Phone size={14} /> Só com telefone</button>
            {porGuardar.length > 0 && (
              <button className="px-saveall" onClick={() => guardar(porGuardar)}><Save size={15} /> Guardar {Math.min(porGuardar.length, 30)} nas minhas leads</button>
            )}
          </div>

          <section className="px-grid">
            <div className="px-mapwrap"><div ref={mapaEl} className="px-map" /></div>

            <div className="px-list">
              {lista.length === 0 && <div className="px-empty">Nenhuma com telefone neste raio. Desliga “Só com telefone” ou aumenta o raio.</div>}
              {lista.map(({ n, i }) => {
                const h = hue(n.nome);
                const ok = n.telefone ? guardados[n.telefone] : false;
                return (
                  <div key={i} ref={(el) => { cartoes.current[i] = el; }} className={"px-card" + (sel === i ? " sel" : "")} onClick={() => setSel(i)}>
                    <div className="px-card-top">
                      <div className="px-av" style={{ background: `linear-gradient(135deg, hsl(${h} 80% 60%), hsl(${(h + 50) % 360} 80% 45%))` }}>{iniciais(n.nome)}</div>
                      <div className="px-meta">
                        <div className="px-name">{n.nome}</div>
                        <div className="px-tags">
                          {n.categoria && <span className="px-tag">{n.categoria}</span>}
                          {n.distancia_km != null && <span className="px-tag dim">{n.distancia_km} km</span>}
                          {n.origem === "web" && <span className="px-tag web"><Globe size={11} /> web</span>}
                          {!n.site && <span className="px-tag warn">sem site</span>}
                        </div>
                        {(n.morada || n.localidade) && <div className="px-addr">{[n.morada, n.localidade].filter(Boolean).join(" · ")}</div>}
                      </div>
                    </div>

                    {n.telefone && <div className="px-phone">{telFmt(n.telefone)}</div>}
                    {n.sugestao && <div className="px-sug"><Sparkles size={14} /> {n.sugestao}</div>}

                    <div className="px-actions" onClick={(e) => e.stopPropagation()}>
                      {n.telefone ? (
                        <>
                          <a className="px-btn call" href={`tel:+351${n.telefone}`}><Phone size={16} /> Ligar</a>
                          {n.telefone.startsWith("9") && <a className="px-btn wa" href={`https://wa.me/351${n.telefone}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
                          <button className={"px-btn save" + (ok ? " done" : "")} disabled={ok} onClick={() => guardar([n])}>{ok ? <><Check size={16} /> Guardada</> : <><Save size={16} /> Guardar</>}</button>
                        </>
                      ) : (
                        <a className="px-btn ghost" href={`https://www.google.com/search?q=${encodeURIComponent(`${n.nome} ${n.localidade || local} telefone`)}`} target="_blank" rel="noopener noreferrer"><Search size={14} /> Procurar telefone</a>
                      )}
                      {n.site && <a className="px-btn ghost" href={n.site} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Site</a>}
                      {n.redes && <a className="px-btn ghost" href={n.redes} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Redes</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <p className="px-foot">Dados públicos do OpenStreetMap e da web. Confirma o contacto na chamada · empresas na Lista Robinson não devem receber marketing.</p>
        </>
      )}
    </div>
  );
}

const CSS = `
.px-stage{--b:rgba(255,255,255,.08);--t:#E2E8F0;--m:#94A3B8;position:relative;margin:-8px auto 0;max-width:1180px;padding:28px clamp(14px,3vw,32px) 36px;border-radius:28px;color:var(--t);
  background:radial-gradient(1100px 520px at 0% -10%,rgba(99,102,241,.38),transparent 60%),radial-gradient(800px 480px at 110% 0%,rgba(16,185,129,.22),transparent 60%),radial-gradient(700px 400px at 50% 120%,rgba(236,72,153,.14),transparent 60%),#060914;
  box-shadow:0 30px 80px -30px rgba(2,6,23,.8),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden}
.px-stage:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:36px 36px;mask-image:linear-gradient(#000,transparent 70%);pointer-events:none}
.px-hero{position:relative;margin-bottom:22px;animation:pxUp .6s ease both}
.px-eyebrow{display:inline-flex;gap:6px;align-items:center;font-size:11px;letter-spacing:.18em;font-weight:700;color:#A5B4FC;padding:6px 10px;border:1px solid rgba(165,180,252,.3);border-radius:999px;background:rgba(99,102,241,.12)}
.px-title{font-size:clamp(30px,5.2vw,52px);line-height:1.02;font-weight:800;letter-spacing:-.03em;margin:14px 0 10px;color:#fff}
.px-title span{background:linear-gradient(90deg,#A5B4FC,#6EE7B7 55%,#F9A8D4);-webkit-background-clip:text;background-clip:text;color:transparent}
.px-sub{color:var(--m);max-width:620px;font-size:15px;line-height:1.55;margin:0}
.px-panel{position:relative;background:rgba(15,23,42,.55);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--b);border-radius:22px;padding:16px;box-shadow:0 20px 50px -20px rgba(0,0,0,.6);animation:pxUp .6s .08s ease both}
.px-presets{display:flex;gap:8px;overflow-x:auto;padding-bottom:12px;margin-bottom:6px;scrollbar-width:none}
.px-presets::-webkit-scrollbar{display:none}
.px-chip{flex:none;display:inline-flex;gap:6px;align-items:center;padding:8px 13px;border-radius:999px;border:1px solid var(--b);background:rgba(255,255,255,.04);color:var(--t);font-size:13px;font-weight:600;cursor:pointer;transition:.2s}
.px-chip:hover{background:rgba(255,255,255,.09);transform:translateY(-1px)}
.px-chip.on{background:linear-gradient(135deg,#6366F1,#8B5CF6);border-color:transparent;color:#fff;box-shadow:0 8px 24px -8px #6366F1}
.px-row{display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.px-field{display:flex;align-items:center;gap:10px;padding:0 14px;height:52px;border-radius:14px;background:rgba(2,6,23,.55);border:1px solid var(--b);color:var(--m);transition:.2s}
.px-field.grow{flex:1;min-width:220px}
.px-field:focus-within{border-color:#818CF8;box-shadow:0 0 0 4px rgba(129,140,248,.18);color:#A5B4FC}
.px-field input{flex:1;background:none;border:0;outline:0;color:#fff;font-size:16px;min-width:0}
.px-field input::placeholder{color:#64748B}
.px-locate{display:inline-flex;align-items:center;gap:8px;height:52px;padding:0 16px;border-radius:14px;border:1px solid var(--b);background:rgba(255,255,255,.05);color:var(--t);font-weight:700;cursor:pointer;transition:.2s}
.px-locate.on{background:rgba(16,185,129,.16);border-color:rgba(16,185,129,.5);color:#6EE7B7}
.px-raio{display:flex;align-items:center;gap:12px;margin:4px 0 14px;flex-wrap:wrap}
.px-raio>span{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--m);font-weight:700}
.px-seg{display:flex;background:rgba(2,6,23,.55);border:1px solid var(--b);border-radius:12px;padding:3px}
.px-seg button{border:0;background:none;color:var(--m);padding:7px 12px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;transition:.2s}
.px-seg button.on{background:rgba(255,255,255,.1);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.px-cta{width:100%;height:58px;border:0;border-radius:16px;font-size:17px;font-weight:800;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
  background:linear-gradient(110deg,#4F46E5,#7C3AED 45%,#059669);background-size:200% 100%;animation:pxFlow 6s ease infinite;box-shadow:0 18px 40px -14px rgba(99,102,241,.9),inset 0 1px 0 rgba(255,255,255,.25);transition:transform .15s}
.px-cta:active{transform:scale(.985)}
.px-cta:disabled{cursor:wait;opacity:.92}
.px-spin{width:18px;height:18px;border-radius:999px;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;animation:pxRot .8s linear infinite}
.px-msg{margin-top:12px;padding:10px 12px;border-radius:12px;font-size:14px}
.px-msg.err{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#FCA5A5}
.px-msg.ok{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);color:#6EE7B7}
.px-loading{display:grid;grid-template-columns:200px 1fr;gap:18px;margin-top:20px;align-items:center}
.px-radar{width:180px;height:180px;border-radius:999px;position:relative;margin:auto;background:radial-gradient(circle,rgba(16,185,129,.18) 0 1px,transparent 1px 30%,rgba(16,185,129,.14) 30% calc(30% + 1px),transparent calc(30% + 1px) 60%,rgba(16,185,129,.12) 60% calc(60% + 1px),transparent calc(60% + 1px));border:1px solid rgba(16,185,129,.35);box-shadow:0 0 60px -10px rgba(16,185,129,.5)}
.px-radar div{position:absolute;inset:0;border-radius:999px;background:conic-gradient(from 0deg,rgba(16,185,129,.55),transparent 25%);animation:pxRot 1.6s linear infinite}
.px-skel{display:grid;gap:10px}
.px-sk{height:78px;border-radius:16px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:200% 100%;animation:pxShim 1.2s ease infinite}
.px-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0 12px;animation:pxUp .5s ease both}
.px-stats div{padding:14px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--b)}
.px-stats b{display:block;font-size:28px;font-weight:800;color:#fff;letter-spacing:-.02em}
.px-stats .g b{background:linear-gradient(90deg,#6EE7B7,#34D399);-webkit-background-clip:text;background-clip:text;color:transparent}
.px-stats span{font-size:12px;color:var(--m);text-transform:uppercase;letter-spacing:.1em;font-weight:700}
.px-toolbar{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;margin-bottom:12px}
.px-toggle,.px-saveall{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;border:1px solid var(--b);background:rgba(255,255,255,.04);color:var(--t)}
.px-toggle.on{border-color:rgba(16,185,129,.5);color:#6EE7B7;background:rgba(16,185,129,.12)}
.px-saveall{background:linear-gradient(135deg,#059669,#10B981);border-color:transparent;color:#fff;box-shadow:0 10px 24px -10px #10B981}
.px-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:16px;align-items:start}
.px-mapwrap{position:sticky;top:12px;border-radius:20px;overflow:hidden;border:1px solid var(--b);box-shadow:0 20px 50px -20px rgba(0,0,0,.7)}
.px-map{height:min(70vh,640px);background:#0B1220}
.px-map .leaflet-tile-pane{filter:invert(1) hue-rotate(195deg) brightness(.82) contrast(.92) saturate(.6)}
.px-map .leaflet-control-attribution{background:rgba(2,6,23,.6);color:#94A3B8}
.px-map .leaflet-control-attribution a{color:#A5B4FC}
.px-list{display:grid;gap:12px}
.px-card{padding:16px;border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.025));border:1px solid var(--b);cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s;animation:pxUp .45s ease both}
.px-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.16)}
.px-card.sel{border-color:rgba(16,185,129,.6);box-shadow:0 0 0 4px rgba(16,185,129,.12),0 20px 40px -20px rgba(16,185,129,.5)}
.px-card-top{display:flex;gap:12px}
.px-av{flex:none;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-weight:800;color:#fff;font-size:15px;box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
.px-meta{min-width:0;flex:1}
.px-name{font-weight:800;font-size:16px;color:#fff;line-height:1.25}
.px-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.px-tag{display:inline-flex;gap:4px;align-items:center;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(129,140,248,.16);color:#C7D2FE}
.px-tag.dim{background:rgba(255,255,255,.07);color:var(--m)}
.px-tag.web{background:rgba(56,189,248,.14);color:#7DD3FC}
.px-tag.warn{background:rgba(251,191,36,.14);color:#FCD34D}
.px-addr{font-size:12.5px;color:var(--m);margin-top:6px}
.px-phone{margin:12px 0 2px;font-size:22px;font-weight:800;letter-spacing:.04em;color:#fff;font-variant-numeric:tabular-nums}
.px-sug{display:flex;gap:8px;margin-top:10px;font-size:13px;line-height:1.45;color:#DDD6FE;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg,rgba(124,58,237,.16),rgba(79,70,229,.08));border:1px solid rgba(167,139,250,.2)}
.px-sug svg{flex:none;margin-top:2px;color:#C4B5FD}
.px-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.px-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:12px;font-weight:800;font-size:14px;text-decoration:none;border:1px solid transparent;cursor:pointer;color:#fff;transition:transform .15s,filter .15s}
.px-btn:active{transform:scale(.97)}
.px-btn.call{background:linear-gradient(135deg,#059669,#22C55E);box-shadow:0 10px 22px -10px #22C55E}
.px-btn.wa{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.4);color:#86EFAC}
.px-btn.save{background:linear-gradient(135deg,#4F46E5,#7C3AED)}
.px-btn.save.done{background:rgba(255,255,255,.08);color:#6EE7B7;cursor:default}
.px-btn.ghost{background:rgba(255,255,255,.05);border-color:var(--b);color:var(--t);font-weight:700}
.px-empty{padding:20px;border-radius:16px;border:1px dashed rgba(255,255,255,.15);color:var(--m);text-align:center}
.px-foot{font-size:12px;color:#64748B;margin:18px 0 0;text-align:center}
@media (max-width:860px){.px-grid{grid-template-columns:1fr}.px-mapwrap{position:relative;top:0}.px-map{height:300px}.px-loading{grid-template-columns:1fr}.px-radar{width:140px;height:140px}}
@keyframes pxUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes pxRot{to{transform:rotate(360deg)}}
@keyframes pxShim{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes pxFlow{0%,100%{background-position:0 0}50%{background-position:100% 0}}
`;
