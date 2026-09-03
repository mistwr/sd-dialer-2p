"use client";

import { useState } from "react";
import { CampanhaCodigosPage } from "../campanhas/CampanhaCodigosPage";
import { SimuladorEnergiaCard } from "../simulador/SimuladorEnergiaCard";
import { MateriaisFormacaoGrid } from "./MateriaisFormacaoGrid";
import { MarketingSlideshow } from "./MarketingSlideshow";

type Seccao = "materiais" | "codigos" | "simulador";

const SECCOES: { id: Seccao; label: string }[] = [
  { id: "materiais", label: "Materiais de Formação" },
  { id: "codigos", label: "Códigos de Registo" },
  { id: "simulador", label: "Simulador de Poupança" },
];

/**
 * Aba "Formação" — ponto único onde a equipa sabe sempre onde ir buscar:
 *  - materiais/guias de formação (liga aos manuais/Academia já existentes)
 *  - todos os códigos de registo D2D (Fibra, Satélite, Energia)
 *  - o simulador de poupança de energia para mostrar ao cliente
 *
 * Integração sugerida: app/formacao/page.tsx + entrada "Formação" no menu
 * lateral, ao lado de "Campanhas".
 */
export function FormacaoPage() {
  const [seccao, setSeccao] = useState<Seccao>("materiais");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Formação</h1>

      <MarketingSlideshow />

      <div className="mb-6 flex justify-end">
        <a
          href="https://apolo.meo.pt/login.php"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        >
          Registo APOLO ↗
        </a>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {SECCOES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeccao(s.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              seccao === s.id
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {seccao === "materiais" && (
        <div>
          <p className="mb-4 text-sm text-gray-500">
            Guiões, scripts e posts da equipa MyPoupar Elite MEO.
          </p>
          <MateriaisFormacaoGrid />
        </div>
      )}

      {seccao === "codigos" && <CampanhaCodigosPage embutido />}

      {seccao === "simulador" && <SimuladorEnergiaCard />}
    </div>
  );
}
