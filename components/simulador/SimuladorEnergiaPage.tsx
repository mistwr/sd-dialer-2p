"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

const BASE = "https://simuladorsolucoesdiferentes.netlify.app";
const TABS = [
  { id: "eletricidade", label: "Eletricidade", path: "/eletricidade-tiagofelicia" },
  { id: "gas", label: "Gás natural", path: "/gas-natural-tiagofelicia" },
  { id: "autoconsumo", label: "Autoconsumo (painéis)", path: "/autoconsumo-tiagofelicia" },
];

export function SimuladorEnergiaPage() {
  const [tab, setTab] = useState(TABS[0]);
  const url = BASE + tab.path;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", padding: 16, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginRight: 8 }}>Simulador de energia</h1>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t)}
            style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer",
              border: "1.5px solid " + (tab.id === t.id ? "#0F766E" : "#E2E8F0"),
              background: tab.id === t.id ? "#0F766E" : "#fff", color: tab.id === t.id ? "#fff" : "#334155" }}>
            {t.label}
          </button>
        ))}
        <a href={url} target="_blank" rel="noreferrer"
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0F766E", textDecoration: "none" }}>
          Abrir em ecrã inteiro <ExternalLink size={14} />
        </a>
      </div>
      <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
        Pergunta ao cliente a potência (6,9 kVA numa casa normal) e o valor da fatura ou os kWh por mês. Valores finais confirmados pelo consultor.
      </p>
      <iframe key={tab.id} src={url} title="Simulador de energia"
        style={{ flex: 1, width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 12, background: "#fff" }} />
    </div>
  );
}
