"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Megaphone, MessageSquareQuote, Receipt, ScrollText, Sparkles, UserRound } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
type Resumo = { campanhas: number; tarifarios: number; guioes: number; objecoes: number; lead: boolean };

const ACOES_GERAIS = [
  "Que campanhas estão ativas e qual vendo primeiro?",
  "Dá-me um guião de abertura para uma chamada a frio (fibra)",
  "O cliente diz que está caro. Como respondo?",
  "O cliente diz que ainda tem fidelização. O que faço?",
  "Como fecho uma venda de energia?",
  "Que perguntas faço para descobrir o que o cliente paga?",
];
const ACOES_LEAD = [
  "O que ofereço a esta lead e porquê?",
  "Escreve-me a abertura da chamada para esta lead",
  "Que objeções vou ouvir e como respondo?",
  "Qual é o próximo passo com esta lead?",
];

function Rico({ t }: { t: string }) {
  const linhas = t.split("\n");
  return (
    <div className="cv-rich">
      {linhas.map((l, i) => {
        const b = /^\s*[-•*]\s+/.test(l);
        const n = /^\s*\d+[.)]\s+/.test(l);
        const txt = l.replace(/^\s*[-•*]\s+/, "").replace(/^#{1,4}\s*/, "");
        const partes = txt.split(/(\*\*[^*]+\*\*)/g).map((p, k) => (p.startsWith("**") && p.endsWith("**") ? <strong key={k}>{p.slice(2, -2)}</strong> : <span key={k}>{p}</span>));
        if (!l.trim()) return <div key={i} style={{ height: 8 }} />;
        return <div key={i} className={b ? "li" : n ? "ln" : /^#{1,4}\s/.test(l) ? "h" : ""}>{partes}</div>;
      })}
    </div>
  );
}

export function CoachVendas() {
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadNome, setLeadNome] = useState("");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("lead");
    setLeadId(id);
    fetch(`/api/ia/vendas${id ? `?lead=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => { setResumo(j.resumo || null); setLeadNome(j.leadNome || ""); }).catch(() => {});
  }, []);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  async function enviar(texto?: string) {
    const q = (texto ?? input).trim();
    if (!q || busy) return;
    setInput(""); setErro("");
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setBusy(true);
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const r = await fetch("/api/ia/vendas", {
          method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(50000),
          body: JSON.stringify({ messages: next, leadId }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.reply) { setMsgs((m) => [...m, { role: "assistant", content: j.reply }]); setBusy(false); return; }
        if (tentativa === 1) setErro(j.error || "O Coach não respondeu agora. Toca outra vez em enviar.");
      } catch { if (tentativa === 1) setErro("A ligação falhou. Toca outra vez em enviar."); }
    }
    setBusy(false);
  }

  const acoes = leadId && leadNome ? ACOES_LEAD : ACOES_GERAIS;

  return (
    <div className="cv-stage">
      <style>{CSS}</style>
      <header className="cv-head">
        <div className="cv-eyebrow"><Sparkles size={14} /> COACH DE VENDAS · IA</div>
        <h1 className="cv-title">Vende mais, <span>com a campanha certa.</span></h1>
        <p className="cv-sub">O Coach conhece as campanhas, os tarifários, os guiões e as objeções carregados no SD Dialer, e diz-te o que oferecer, o que dizer e como fechar.</p>
        <div className="cv-kpis">
          <span><Megaphone size={14} /> {resumo ? resumo.campanhas : "…"} campanhas</span>
          <span><Receipt size={14} /> {resumo ? resumo.tarifarios : "…"} tarifários</span>
          <span><ScrollText size={14} /> {resumo ? resumo.guioes : "…"} guiões</span>
          <span><MessageSquareQuote size={14} /> {resumo ? resumo.objecoes : "…"} objeções</span>
        </div>
        {leadNome && <div className="cv-lead"><UserRound size={15} /> A preparar a chamada para <b>{leadNome}</b></div>}
      </header>

      <section className="cv-chat">
        {msgs.length === 0 && (
          <div className="cv-start">
            <div className="cv-orb"><Sparkles size={26} /></div>
            <p>Por onde começamos?</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={"cv-msg " + m.role}>
            {m.role === "assistant" && <div className="cv-av"><Sparkles size={15} /></div>}
            <div className="cv-bub">{m.role === "assistant" ? <Rico t={m.content} /> : m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="cv-msg assistant">
            <div className="cv-av"><Sparkles size={15} /></div>
            <div className="cv-bub"><span className="cv-dots"><i /><i /><i /></span></div>
          </div>
        )}
        {erro && <div className="cv-err">{erro}</div>}
        <div ref={fim} />
      </section>

      <div className="cv-quick">
        {acoes.map((a) => <button key={a} disabled={busy} onClick={() => enviar(a)}>{a}</button>)}
      </div>

      <div className="cv-input">
        <textarea value={input} rows={1} onChange={(e) => setInput(e.target.value)} placeholder="Pergunta ao Coach…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
        <button aria-label="Enviar" disabled={busy || !input.trim()} onClick={() => enviar()}><ArrowUp size={20} /></button>
      </div>
    </div>
  );
}

const CSS = `
.cv-stage{--b:rgba(255,255,255,.08);--t:#E2E8F0;--m:#94A3B8;position:relative;max-width:980px;margin:0 auto 24px;padding:26px clamp(14px,3vw,30px) 18px;border-radius:28px;color:var(--t);overflow:hidden;
  background:radial-gradient(900px 460px at 100% -10%,rgba(139,92,246,.38),transparent 60%),radial-gradient(800px 420px at -10% 20%,rgba(16,185,129,.18),transparent 60%),#060914;box-shadow:0 30px 80px -30px rgba(2,6,23,.8),inset 0 1px 0 rgba(255,255,255,.06)}
.cv-head{animation:cvUp .6s ease both}
.cv-eyebrow{display:inline-flex;gap:6px;align-items:center;font-size:11px;letter-spacing:.18em;font-weight:700;color:#C4B5FD;padding:6px 10px;border:1px solid rgba(196,181,253,.3);border-radius:999px;background:rgba(139,92,246,.14)}
.cv-title{font-size:clamp(28px,4.6vw,44px);line-height:1.04;font-weight:800;letter-spacing:-.03em;margin:14px 0 8px;color:#fff}
.cv-title span{background:linear-gradient(90deg,#C4B5FD,#6EE7B7);-webkit-background-clip:text;background-clip:text;color:transparent}
.cv-sub{color:var(--m);font-size:14.5px;line-height:1.55;max-width:640px;margin:0}
.cv-kpis{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.cv-kpis span{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;font-weight:700;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid var(--b);color:#CBD5E1}
.cv-lead{margin-top:12px;display:inline-flex;gap:8px;align-items:center;padding:9px 13px;border-radius:12px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);color:#A7F3D0;font-size:14px}
.cv-lead b{color:#fff}
.cv-chat{margin-top:18px;min-height:260px;max-height:58vh;overflow-y:auto;padding:14px;border-radius:20px;background:rgba(2,6,23,.45);border:1px solid var(--b);display:flex;flex-direction:column;gap:14px}
.cv-start{margin:auto;text-align:center;color:var(--m)}
.cv-orb{width:64px;height:64px;border-radius:999px;margin:0 auto 10px;display:grid;place-items:center;color:#fff;background:radial-gradient(circle at 30% 30%,#A78BFA,#6D28D9 60%,#1E1B4B);box-shadow:0 0 60px -6px #8B5CF6;animation:cvPulse 2.4s ease-in-out infinite}
.cv-msg{display:flex;gap:10px;align-items:flex-start;animation:cvUp .35s ease both}
.cv-msg.user{justify-content:flex-end}
.cv-av{flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#7C3AED,#4F46E5)}
.cv-bub{max-width:min(82%,720px);padding:11px 14px;border-radius:16px;font-size:14.5px;line-height:1.55}
.cv-msg.user .cv-bub{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;border-bottom-right-radius:6px;white-space:pre-wrap}
.cv-msg.assistant .cv-bub{background:rgba(255,255,255,.05);border:1px solid var(--b);border-top-left-radius:6px}
.cv-rich strong{color:#fff}
.cv-rich .li{position:relative;padding-left:16px;margin:3px 0}
.cv-rich .li:before{content:"";position:absolute;left:3px;top:.62em;width:6px;height:6px;border-radius:99px;background:#A78BFA}
.cv-rich .ln{margin:3px 0;padding-left:2px}
.cv-rich .h{font-weight:800;color:#fff;margin-top:4px}
.cv-dots{display:inline-flex;gap:5px}
.cv-dots i{width:7px;height:7px;border-radius:99px;background:#A78BFA;animation:cvDot 1s ease-in-out infinite}
.cv-dots i:nth-child(2){animation-delay:.15s}.cv-dots i:nth-child(3){animation-delay:.3s}
.cv-err{align-self:center;padding:8px 12px;border-radius:10px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#FCA5A5;font-size:13.5px}
.cv-quick{display:flex;gap:8px;overflow-x:auto;padding:12px 0 10px;scrollbar-width:none}
.cv-quick::-webkit-scrollbar{display:none}
.cv-quick button{flex:none;padding:8px 13px;border-radius:999px;border:1px solid var(--b);background:rgba(255,255,255,.04);color:#DDD6FE;font-size:13px;font-weight:600;cursor:pointer;transition:.2s;white-space:nowrap}
.cv-quick button:hover{background:rgba(139,92,246,.18);border-color:rgba(167,139,250,.45)}
.cv-quick button:disabled{opacity:.5;cursor:wait}
.cv-input{display:flex;gap:10px;align-items:flex-end;padding:8px;border-radius:18px;background:rgba(2,6,23,.6);border:1px solid var(--b)}
.cv-input:focus-within{border-color:#8B5CF6;box-shadow:0 0 0 4px rgba(139,92,246,.18)}
.cv-input textarea{flex:1;resize:none;background:none;border:0;outline:0;color:#fff;font-size:16px;line-height:1.4;padding:8px 6px;max-height:140px;font-family:inherit}
.cv-input textarea::placeholder{color:#64748B}
.cv-input button{flex:none;width:44px;height:44px;border-radius:14px;border:0;display:grid;place-items:center;color:#fff;cursor:pointer;background:linear-gradient(135deg,#7C3AED,#059669);box-shadow:0 10px 24px -10px #8B5CF6}
.cv-input button:disabled{opacity:.45;cursor:default}
@keyframes cvUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes cvPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes cvDot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
`;
