"use client";

import { useState } from "react";
import type { TabelaCodigos as TabelaCodigosType } from "@/lib/data/meo-codigos";

function CodigoPill({ valor }: { valor: string | null }) {
  const [copiado, setCopiado] = useState(false);

  if (valor === null) {
    return <span className="text-gray-300">—</span>;
  }
  if (valor === "AGUARDA") {
    return (
      <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
        A aguardar
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(valor);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1200);
      }}
      className={`min-h-9 rounded-lg border px-3 py-2 font-mono text-sm font-semibold transition-colors ${
        copiado
          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
          : "border-gray-200 bg-white text-gray-800 hover:border-indigo-300 hover:bg-indigo-50"
      }`}
      title="Toca para copiar o código"
    >
      {copiado ? "Copiado!" : valor}
    </button>
  );
}

/**
 * Renderiza uma TabelaCodigos (ver lib/data/meo-codigos.ts) como uma tabela
 * responsiva, com scroll horizontal em mobile e código copiável a um toque.
 */
export function TabelaCodigos({ tabela }: { tabela: TabelaCodigosType }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">
        {tabela.titulo}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead>
            <tr className="bg-white">
              <th className="sticky left-0 z-10 min-w-[220px] bg-white px-4 py-2 text-left font-medium text-gray-600">
                Cenário
              </th>
              {tabela.colunas.map((coluna) => (
                <th key={coluna} className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-600">
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tabela.linhas.map((linha) => (
              <tr key={linha.cenario} className="align-top">
                <td className="sticky left-0 z-10 min-w-[220px] bg-white px-4 py-3 text-gray-700">
                  {linha.cenario}
                  {linha.nota && (
                    <p className="mt-1 text-xs italic text-gray-400">{linha.nota}</p>
                  )}
                </td>
                {linha.valores.map((valor, i) => (
                  <td key={i} className="whitespace-nowrap px-3 py-3">
                    <CodigoPill valor={valor} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 md:hidden">
        {tabela.linhas.map((linha) => (
          <article key={linha.cenario} className="px-4 py-4">
            <h3 className="text-[15px] font-semibold leading-snug text-gray-800">{linha.cenario}</h3>
            {linha.nota && <p className="mt-1.5 text-xs italic leading-relaxed text-gray-400">{linha.nota}</p>}
            <div className="mt-3 grid gap-2">
              {linha.valores.map((valor, i) => (
                <div key={`${linha.cenario}-${i}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                  <span className="min-w-0 text-xs font-medium leading-snug text-gray-500">{tabela.colunas[i]}</span>
                  <div className="shrink-0"><CodigoPill valor={valor} /></div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
