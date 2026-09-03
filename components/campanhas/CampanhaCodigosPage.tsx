"use client";

import { useMemo, useState } from "react";
import { folhasCodigos, pesquisarCodigos } from "@/lib/data/meo-codigos";
import { TabelaCodigos } from "./TabelaCodigos";

/**
 * Página "Campanhas" — um separador por produto (MEO Fibra / MEO Satélite /
 * MEO Energia), cada um com as respetivas tabelas de códigos D2D, mais uma
 * pesquisa global no topo para encontrar um código sem saber em que
 * separador está.
 *
 * Integração sugerida: colocar em app/campanhas/page.tsx (ao lado dos
 * separadores DIGI / Solar / Seguros que já existem) E dentro da aba
 * Formação (passa `embutido` para esconder o título/padding duplicados,
 * já que aí já existe um título "Formação" por cima).
 */
export function CampanhaCodigosPage({ embutido = false }: { embutido?: boolean }) {
  const [produtoAtivo, setProdutoAtivo] = useState(folhasCodigos[0].id);
  const [query, setQuery] = useState("");

  const resultadosPesquisa = useMemo(() => pesquisarCodigos(query), [query]);
  const folhaAtiva = folhasCodigos.find((f) => f.id === produtoAtivo)!;
  const aPesquisar = query.trim().length > 0;

  return (
    <div className={embutido ? "" : "mx-auto max-w-5xl px-4 py-6"}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!embutido && <h1 className="text-xl font-bold text-gray-900">Campanhas — Códigos D2D</h1>}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar cenário ou código…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm sm:w-72"
        />
      </div>

      {!aPesquisar && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {folhasCodigos.map((folha) => (
            <button
              key={folha.id}
              onClick={() => setProdutoAtivo(folha.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                produtoAtivo === folha.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {folha.produto}
            </button>
          ))}
        </div>
      )}

      {aPesquisar ? (
        <div>
          <p className="mb-3 text-sm text-gray-500">
            {resultadosPesquisa.length} resultado(s) para “{query}”
          </p>
          <div className="space-y-2">
            {resultadosPesquisa.map((r, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
                  {r.folha.produto} · {r.tabela.titulo}
                </p>
                <p className="text-gray-700">{r.linha.cenario}</p>
                <p className="text-gray-500">{r.tabela.colunas[r.colunaIdx]}</p>
                <p className="mt-1 font-mono text-base font-semibold text-gray-900">
                  {r.linha.valores[r.colunaIdx] ?? "—"}
                </p>
              </div>
            ))}
            {resultadosPesquisa.length === 0 && (
              <p className="text-sm text-gray-400">Nenhum código encontrado.</p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-xs text-gray-400">
            Atualizado em {folhaAtiva.atualizadoEm} · toca num código para o copiar
          </p>
          {folhaAtiva.tabelas.map((tabela) => (
            <TabelaCodigos key={tabela.id} tabela={tabela} />
          ))}
        </div>
      )}
    </div>
  );
}
