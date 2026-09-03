"use client";

import { useState } from "react";
import { materiaisFormacao, type MaterialFormacao, type PassoGuiao } from "@/lib/data/materiais-formacao";

/**
 * Cartão do guião "Pronto a usar" renderizado 100% em HTML/CSS — não depende
 * de nenhuma imagem PNG. Usa apenas os dados já existentes em
 * materiais-formacao.ts (passos + destaque). Sem alturas fixas, sem
 * overflow que corte conteúdo — cresce naturalmente com o texto.
 */
function GuiaoHtmlCard({
  titulo,
  subtitulo,
  passos,
  destaque,
}: {
  titulo: string;
  subtitulo?: string;
  passos: PassoGuiao[];
  destaque?: string;
}) {
  return (
    <div className="w-full rounded-xl border border-amber-500/30 bg-gradient-to-b from-slate-950 to-slate-900 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
        MyPoupar MEO
      </p>
      <h3 className="mt-1 text-xl font-extrabold uppercase tracking-tight text-white sm:text-2xl">
        {titulo}
      </h3>
      {subtitulo && <p className="mt-1 text-sm text-slate-400">{subtitulo}</p>}

      <div className="mt-5 space-y-3">
        {passos.map((p) => (
          <div
            key={p.numero}
            className="flex gap-3 rounded-lg border border-amber-500/20 bg-slate-900/60 p-3"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-slate-950">
              {p.numero}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-300">{p.titulo}</p>
              <p className="mt-0.5 text-sm leading-snug text-slate-200">{p.texto}</p>
            </div>
          </div>
        ))}
      </div>

      {destaque && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">
          {destaque}
        </p>
      )}
    </div>
  );
}

function GuiaoCard({ material }: { material: MaterialFormacao }) {
  const [aberto, setAberto] = useState(false);
  const semImagemDefeituosa = material.id === "guiao-pronto-a-usar";

  return (
    <div className="w-full overflow-visible rounded-xl border border-gray-200">
      <div className="w-full p-4">
        {semImagemDefeituosa ? (
          <GuiaoHtmlCard
            titulo={material.titulo}
            subtitulo={material.subtitulo}
            passos={material.passos ?? []}
            destaque={material.destaque}
          />
        ) : (
          <>
            <img
              src={material.imagem}
              alt={material.titulo}
              className="block h-auto w-full max-w-full rounded-lg"
            />
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
                {material.tipo === "guiao" ? "Guião" : "Post"}
              </p>
              <h3 className="text-base font-bold text-gray-900">{material.titulo}</h3>
              {material.subtitulo && (
                <p className="text-sm text-gray-500">{material.subtitulo}</p>
              )}

              {material.notas && (
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  {material.notas.map((n, i) => (
                    <li key={i}>• {n}</li>
                  ))}
                </ul>
              )}

              {material.passos && (
                <button
                  onClick={() => setAberto((v) => !v)}
                  className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
                >
                  {aberto ? "Esconder guião passo a passo" : "Ver guião passo a passo"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {!semImagemDefeituosa && material.passos && aberto && (
        <div className="w-full space-y-3 border-t border-gray-100 bg-gray-50 p-4">
          {material.passos.map((p) => (
            <div key={p.numero} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {p.numero}
              </span>
              <div>
                <p className="font-semibold text-gray-800">{p.titulo}</p>
                <p className="text-gray-600">{p.texto}</p>
              </div>
            </div>
          ))}
          {material.destaque && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              {material.destaque}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Galeria de materiais de formação (guiões + posts), imagem + texto pesquisável. */
export function MateriaisFormacaoGrid() {
  return (
    <div className="w-full space-y-4">
      {materiaisFormacao.map((m) => (
        <GuiaoCard key={m.id} material={m} />
      ))}
    </div>
  );
}
