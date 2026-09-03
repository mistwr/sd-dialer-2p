"use client";

import { useState } from "react";
import { materiaisFormacao, type MaterialFormacao } from "@/lib/data/materiais-formacao";

function GuiaoCard({ material }: { material: MaterialFormacao }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-4">
        {/* Usa a proporção NATIVA do ficheiro. Sem fill, sem aspect ratio imposto e sem altura máxima. */}
        <div className="mb-4 w-full overflow-hidden rounded-xl bg-slate-950">
          <img
            src={material.imagem}
            alt={material.titulo}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full max-w-full"
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
            {material.tipo === "guiao" ? "Guião" : "Post"}
          </p>

          <h3 className="mt-1 text-lg font-bold leading-tight text-gray-900">
            {material.titulo}
          </h3>

          {material.subtitulo && (
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              {material.subtitulo}
            </p>
          )}

          {material.notas && (
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-gray-600">
              {material.notas.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-indigo-500">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}

          {material.passos && (
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="mt-4 rounded-lg bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              {aberto ? "Esconder guião passo a passo" : "Ver guião passo a passo"}
            </button>
          )}
        </div>
      </div>

      {material.passos && aberto && (
        <div className="space-y-4 border-t border-gray-100 bg-gray-50 p-4">
          {material.passos.map((p) => (
            <div key={p.numero} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {p.numero}
              </span>

              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{p.titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{p.texto}</p>
              </div>
            </div>
          ))}

          {material.destaque && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-900">
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
    <div className="w-full space-y-5">
      {materiaisFormacao
        .filter((m) => m.id !== "post-bom-arranque" && m.id !== "post-modo-poupanca")
        .map((m) => (
          <GuiaoCard key={m.id} material={m} />
        ))}
    </div>
  );
}
